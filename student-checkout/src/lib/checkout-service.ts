import { supabase, type CurrentCheckout, type GenderAvailability, type CheckoutLog, type Student } from './supabase';

export type { CheckoutLog } from './supabase';

type FinalizeAction = 'IN' | 'AUTO';

type CheckoutFinalizationContext = {
  id: string;
  checkout_time: string;
  student: Student;
  destination?: { name?: string } | string | null;
};

type NormalizedGender = 'Male' | 'Female';

async function finalizeCheckoutRecord(
  context: CheckoutFinalizationContext,
  action: FinalizeAction
): Promise<number> {
  if (!context.student?.id) {
    throw new Error('Missing student information for checkout finalization');
  }

  if (!context.checkout_time) {
    throw new Error('Missing checkout time for checkout finalization');
  }

  const checkoutTime = new Date(context.checkout_time);
  const checkinTime = new Date();
  const durationMinutes = Math.max(
    0,
    Math.round((checkinTime.getTime() - checkoutTime.getTime()) / 60000)
  );

  const destinationName = typeof context.destination === 'string'
    ? context.destination
    : context.destination?.name ?? null;

  await supabase.from('checkout_log').insert({
    student_id: context.student.id,
    student_name: context.student.name,
    student_email: context.student.email,
    student_gender: context.student.gender,
    class_name: context.student.class_name,
    destination_name: destinationName,
    action,
    checkout_time: context.checkout_time,
    checkin_time: checkinTime.toISOString(),
    duration_minutes: durationMinutes
  });

  await supabase
    .from('checkout_log')
    .delete()
    .eq('student_id', context.student.id)
    .eq('checkout_time', context.checkout_time)
    .eq('action', 'OUT');

  await supabase.from('current_checkouts').delete().eq('id', context.id);

  return durationMinutes;
}

function normalizeGender(value?: string | null): NormalizedGender | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('m')) return 'Male';
  if (lower.startsWith('f')) return 'Female';
  return null;
}

async function getClassGenderAvailabilityForClass(className: string): Promise<GenderAvailability> {
  const normalized = className?.trim();
  if (!normalized) {
    return { male: true, female: true };
  }

  const { data, error } = await supabase
    .from('current_checkouts')
    .select('students!inner(class_name, gender)')
    .eq('students.class_name', normalized);

  if (error) throw error;

  const availability: GenderAvailability = { male: true, female: true };
  (data ?? []).forEach((checkout: any) => {
    const gender = normalizeGender(checkout.students?.gender);
    if (gender === 'Male') availability.male = false;
    if (gender === 'Female') availability.female = false;
  });

  return availability;
}

export class CheckoutService {
  static async getGenderAvailability(email?: string): Promise<GenderAvailability> {
    await processAutoReturns();

    const normalizedEmail = email?.toLowerCase().trim();
    if (!normalizedEmail) {
      return { male: true, female: true };
    }

    const { data: student } = await supabase
      .from('students')
      .select('class_name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!student?.class_name) {
      return { male: true, female: true };
    }

    try {
      return await getClassGenderAvailabilityForClass(student.class_name);
    } catch (error) {
      console.error('Failed to load class availability', error);
      return { male: true, female: true };
    }
  }

  static async getCurrentCheckouts(): Promise<CurrentCheckout[]> {
    const { data, error } = await supabase
      .from('current_checkouts')
      .select(`
        *,
        student:students(*),
        destination:destinations(*)
      `)
      .order('checkout_time', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async checkOut(email: string, destinationId: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (studentError || !student) {
      return { success: false, message: 'Student not found in roster.' };
    }

    const { data: existingCheckout } = await supabase
      .from('current_checkouts')
      .select('id')
      .eq('student_id', student.id)
      .maybeSingle();

    if (existingCheckout) {
      return { success: false, message: 'You are already checked out.' };
    }

    await processAutoReturns();

    const className = student.class_name?.trim();
    const normalizedGender = normalizeGender(student.gender);
    if (className && normalizedGender) {
      try {
        const classAvailability = await getClassGenderAvailabilityForClass(className);
        if (normalizedGender === 'Male' && !classAvailability.male) {
          return {
            success: false,
            message: `Another boy from ${className} is already checked out.`
          };
        }
        if (normalizedGender === 'Female' && !classAvailability.female) {
          return {
            success: false,
            message: `Another girl from ${className} is already checked out.`
          };
        }
      } catch (error) {
        console.error('Failed to verify class availability', error);
        return {
          success: false,
          message: 'Unable to verify class availability. Please try again.'
        };
      }
    }

    const { data: destination } = await supabase
      .from('destinations')
      .select('name')
      .eq('id', destinationId)
      .maybeSingle();

    if (!destination) {
      return { success: false, message: 'Invalid destination.' };
    }

    const autoReturnMinutes = await getAutoReturnMinutes();
    const checkoutTime = new Date();
    const autoReturnAt = new Date(checkoutTime.getTime() + autoReturnMinutes * 60000);

    const { error: checkoutError } = await supabase
      .from('current_checkouts')
      .insert({
        student_id: student.id,
        destination_id: destinationId,
        checkout_time: checkoutTime.toISOString(),
        auto_return_at: autoReturnAt.toISOString()
      });

    if (checkoutError) {
      return { success: false, message: 'Failed to check out. Please try again.' };
    }

    await supabase
      .from('checkout_log')
      .insert({
        student_id: student.id,
        student_name: student.name,
        student_email: student.email,
        student_gender: student.gender,
        class_name: student.class_name,
        destination_name: destination.name,
        action: 'OUT',
        checkout_time: checkoutTime.toISOString()
      });

    return { success: true, message: `Checked out to ${destination.name}.` };
  }

  static async checkIn(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!student) {
      return { success: false, message: 'Student not found in roster.' };
    }

    const { data: checkout } = await supabase
      .from('current_checkouts')
      .select(`
        *,
        destination:destinations(name)
      `)
      .eq('student_id', student.id)
      .maybeSingle();

    if (!checkout) {
      return { success: false, message: 'You are not currently checked out.' };
    }

    try {
      const durationMinutes = await finalizeCheckoutRecord(
        {
          id: checkout.id,
          checkout_time: checkout.checkout_time,
          student,
          destination: checkout.destination
        },
        'IN'
      );

      return { success: true, message: `Checked in after ${durationMinutes} minutes.` };
    } catch (error) {
      console.error('Failed to finalize checkout for student check-in:', error);
      return { success: false, message: 'Failed to check in. Please try again.' };
    }
  }

  static async resetSystem(): Promise<{ success: boolean; message: string }> {
    const { data: checkouts } = await supabase
      .from('current_checkouts')
      .select(`
        *,
        student:students(*),
        destination:destinations(name)
      `);

    if (checkouts && checkouts.length > 0) {
      const checkinTime = new Date().toISOString();

      for (const checkout of checkouts) {
        const checkoutTime = new Date(checkout.checkout_time);
        const durationMinutes = Math.round((Date.now() - checkoutTime.getTime()) / 60000);

        await supabase
          .from('checkout_log')
          .insert({
            student_id: checkout.student.id,
            student_name: checkout.student.name,
            student_email: checkout.student.email,
            student_gender: checkout.student.gender,
            class_name: checkout.student.class_name,
            destination_name: checkout.destination.name,
            action: 'RESET',
            checkout_time: checkout.checkout_time,
            checkin_time: checkinTime,
            duration_minutes: durationMinutes
          });

        await supabase
          .from('checkout_log')
          .delete()
          .eq('student_id', checkout.student.id)
          .eq('checkout_time', checkout.checkout_time)
          .eq('action', 'OUT');
      }
    }

    const { error } = await supabase
      .from('current_checkouts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      return { success: false, message: 'Failed to reset system. Please try again.' };
    }

    const checkedInCount = checkouts?.length || 0;
    return {
      success: true,
      message: `System reset complete. ${checkedInCount} student${checkedInCount !== 1 ? 's' : ''} checked in.`
    };
  }
}

// Compatibility helper functions used by components
async function fetchActiveViaFunction(): Promise<CheckoutLog[] | null> {
  if (typeof fetch === 'undefined') return null;

  const endpoint = (import.meta.env.VITE_ACTIVE_CHECKOUTS_ENDPOINT || '/.netlify/functions/get-active-checkouts').trim();

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // likely running locally without Netlify functions proxy; fall back to Supabase
        return null;
      }
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (payload && Array.isArray(payload.rows)) {
      return payload.rows as CheckoutLog[];
    }
    return null;
  } catch (error) {
    console.error('Active checkout function request failed', error);
    return null;
  }
}

function shapeCurrentCheckoutRow(row: any): CheckoutLog {
  const students = row.students ?? null;
  const destination = row.destination ?? null;
  const destinationName =
    typeof destination === 'string'
      ? destination
      : destination?.name ?? row.destination_name ?? null;

  return {
    id: row.id,
    checkout_time: row.checkout_time,
    auto_return_at: row.auto_return_at ?? null,
    notes: 'notes' in row ? row.notes ?? null : null,
    students,
    destination,
    student_name: students?.name ?? row.student_name ?? null,
    class_name: students?.class_name ?? row.class_name ?? null,
    destination_name: destinationName
  };
}

function shapeCheckoutLogRow(row: any): CheckoutLog {
  const students = row.students
    ? row.students
    : row.student_name
      ? {
          id: row.student_id,
          name: row.student_name,
          email: row.student_email,
          gender: row.student_gender,
          class_name: row.class_name
        }
      : null;

  return {
    id: row.id,
    checkout_time: row.checkout_time,
    auto_return_at: row.auto_return_at ?? null,
    notes: 'notes' in row ? row.notes ?? null : null,
    students,
    destination: row.destination_name ? { name: row.destination_name } : null,
    student_name: row.student_name ?? students?.name ?? null,
    class_name: row.class_name ?? students?.class_name ?? null,
    destination_name: row.destination_name ?? null
  };
}

export async function getActiveCheckouts(): Promise<CheckoutLog[]> {
  const functionRows = await fetchActiveViaFunction();
  if (functionRows) {
    return functionRows;
  }

  let currentRows: any[] = [];
  try {
    const { data } = await supabase
      .from('current_checkouts')
      .select(`*, students:students(*), destination:destinations(*)`)
      .order('checkout_time', { ascending: true });
    currentRows = data ?? [];
  } catch (error) {
    console.error('Failed to load current checkouts view, falling back to checkout_log', error);
  }

  if (currentRows.length > 0) {
    return currentRows.map(shapeCurrentCheckoutRow);
  }

  const { data: logRows, error: logError } = await supabase
    .from('checkout_log')
    .select(`*, students:students(*)`)
    .eq('action', 'OUT')
    .is('checkin_time', null)
    .order('checkout_time', { ascending: true });

  if (logError) throw logError;
  return (logRows ?? []).map(shapeCheckoutLogRow);
}

export async function returnStudent(checkoutId: string): Promise<void> {
  // find the checkout with student info
  const { data: checkoutRows, error: fetchError } = await supabase
    .from('current_checkouts')
    .select(`*, student:students(*), destination:destinations(name)`)
    .eq('id', checkoutId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  const checkout = checkoutRows as any;
  if (!checkout) throw new Error('Checkout not found');

  await finalizeCheckoutRecord(checkout as CheckoutFinalizationContext, 'IN');
}

export async function processAutoReturns(): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('current_checkouts')
    .select(`*, student:students(*), destination:destinations(name)`)
    .not('auto_return_at', 'is', null)
    .lte('auto_return_at', nowIso);

  if (error) throw error;
  const expired = data ?? [];
  let processed = 0;

  for (const checkout of expired) {
    try {
      await finalizeCheckoutRecord(checkout as CheckoutFinalizationContext, 'AUTO');
      processed += 1;
    } catch (autoError) {
      console.error('Automatic return failed', autoError);
    }
  }

  return processed;
}

export async function getAutoReturnMinutes(): Promise<number> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'auto_return_minutes')
    .maybeSingle();

  const parsed = data?.value ? parseInt(String(data.value), 10) : NaN;
  if (Number.isNaN(parsed)) {
    return 10;
  }
  return Math.min(15, Math.max(5, parsed));
}

export async function updateAutoReturnMinutes(minutes: number): Promise<void> {
  const normalized = Math.round(minutes);
  if (normalized < 5 || normalized > 15) {
    throw new Error('Automatic return must be between 5 and 15 minutes');
  }

  const { error } = await supabase
    .from('system_settings')
    .upsert({ key: 'auto_return_minutes', value: String(normalized) }, { onConflict: 'key' });

  if (error) throw error;
}

export type ClassGroup = {
  className: string;
  students: Student[];
};

export async function getClassesWithStudents(): Promise<ClassGroup[]> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('class_name', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;

  const groups = new Map<string, Student[]>();
  (data ?? []).forEach((student) => {
    const classValue = student.class_name ?? '';
    const keyRaw = typeof classValue === 'string' ? classValue.trim() : String(classValue).trim();
    const key = keyRaw.length > 0 ? keyRaw : 'Unassigned';
    const roster = groups.get(key) ?? [];
    roster.push(student);
    groups.set(key, roster);
  });

  return Array.from(groups.entries()).map(([className, students]) => ({
    className,
    students
  }));
}

export async function getCheckoutHistory(): Promise<CheckoutLog[]> {
  const { data, error } = await supabase
    .from('checkout_log')
    .select('*')
    .order('checkout_time', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getFullCheckoutHistory(): Promise<CheckoutLog[]> {
  const { data, error } = await supabase
    .from('checkout_log')
    .select('*')
    .order('checkout_time', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteCheckoutRecord(id: string): Promise<void> {
  const { error } = await supabase.from('checkout_log').delete().eq('id', id);
  if (error) throw error;
}

export async function addStudent(
  name: string,
  email: string,
  gender?: string | null,
  className?: string | null,
  studentId?: string | null,
  grade?: string | null
): Promise<void> {
  if (!email || !email.trim()) {
    throw new Error('Email is required to add a student');
  }

  const payload: any = {
    name,
    email: email.trim().toLowerCase()
  };
  if (studentId) payload.student_id = studentId;
  if (grade) payload.grade = grade;
  if (gender) payload.gender = gender;
  if (className) payload.class_name = className;

  const { error } = await supabase.from('students').insert(payload);
  if (error) throw error;
}
