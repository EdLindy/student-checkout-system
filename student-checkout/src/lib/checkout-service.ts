import { supabase, type Student, type CurrentCheckout, type GenderAvailability } from './supabase';

export class CheckoutService {
  static async getGenderAvailability(): Promise<GenderAvailability> {
    const { data: checkouts } = await Bolt Database
      .from('current_checkouts')
      .select(`
        id,
        student:students!inner(gender)
      `)
      .returns<Array<{ student: { gender: 'Male' | 'Female' } }>>();

    const availability: GenderAvailability = {
      male: true,
      female: true
    };

    if (checkouts && checkouts.length > 0) {
      checkouts.forEach(checkout => {
        if (checkout.student?.gender === 'Male') {
          availability.male = false;
        } else if (checkout.student?.gender === 'Female') {
          availability.female = false;
        }
      });
    }

    return availability;
  }

  static async getCurrentCheckouts(): Promise<CurrentCheckout[]> {
    const { data, error } = await Bolt Database
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

    const { data: student, error: studentError } = await Bolt Database
      .from('students')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (studentError || !student) {
      return { success: false, message: 'Student not found in roster.' };
    }

    const { data: existingCheckout } = await Bolt Database
      .from('current_checkouts')
      .select('id')
      .eq('student_id', student.id)
      .maybeSingle();

    if (existingCheckout) {
      return { success: false, message: 'You are already checked out.' };
    }

    const availability = await this.getGenderAvailability();
    if (student.gender === 'Male' && !availability.male) {
      return { success: false, message: 'A boy is already checked out.' };
    }
    if (student.gender === 'Female' && !availability.female) {
      return { success: false, message: 'A girl is already checked out.' };
    }

    const { data: destination } = await Bolt Database
      .from('destinations')
      .select('name')
      .eq('id', destinationId)
      .maybeSingle();

    if (!destination) {
      return { success: false, message: 'Invalid destination.' };
    }

    const { data: settings } = await Bolt Database
      .from('system_settings')
      .select('value')
      .eq('key', 'auto_return_minutes')
      .maybeSingle();

    const autoReturnMinutes = settings ? parseInt(settings.value, 10) : 10;
    const checkoutTime = new Date();
    const autoReturnAt = new Date(checkoutTime.getTime() + autoReturnMinutes * 60000);

    const { error: checkoutError } = await Bolt Database
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

    await Bolt Database
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

    const { data: student } = await Bolt Database
      .from('students')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!student) {
      return { success: false, message: 'Student not found in roster.' };
    }

    const { data: checkout } = await Bolt Database
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

    const checkoutTime = new Date(checkout.checkout_time);
    const checkinTime = new Date();
    const durationMinutes = Math.round((checkinTime.getTime() - checkoutTime.getTime()) / 60000);

    const { error: deleteError } = await Bolt Database
      .from('current_checkouts')
      .delete()
      .eq('id', checkout.id);

    if (deleteError) {
      return { success: false, message: 'Failed to check in. Please try again.' };
    }

    await Bolt Database
      .from('checkout_log')
      .insert({
        student_id: student.id,
        student_name: student.name,
        student_email: student.email,
        student_gender: student.gender,
        class_name: student.class_name,
        destination_name: checkout.destination.name,
        action: 'IN',
        checkout_time: checkout.checkout_time,
        checkin_time: checkinTime.toISOString(),
        duration_minutes: durationMinutes
      });

    return { success: true, message: `Checked in after ${durationMinutes} minutes.` };
  }

  static async resetSystem(): Promise<{ success: boolean; message: string }> {
    const { data: checkouts } = await Bolt Database
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

        await Bolt Database
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
      }
    }

    const { error } = await Bolt Database
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
