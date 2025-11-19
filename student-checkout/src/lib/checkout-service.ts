import { Bolt Database } from './supabase';

export interface Student {
  id: string;
  name: string;
  student_id: string;
  grade: string;
}

export interface CheckoutLog {
  id: string;
  student_id: string;
  checkout_time: string;
  return_time: string | null;
  destination: string;
  notes: string | null;
  students?: Student;
}

export async function getStudents() {
  const { data, error } = await Bolt Database
    .from('students')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data;
}

export async function getActiveCheckouts() {
  const { data, error } = await Bolt Database
    .from('checkout_log')
    .select(`
      *,
      students (
        id,
        name,
        student_id,
        grade
      )
    `)
    .is('return_time', null)
    .order('checkout_time', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function checkoutStudent(studentId: string, destination: string, notes?: string) {
  const { data, error } = await Bolt Database
    .from('checkout_log')
    .insert({
      student_id: studentId,
      destination,
      notes,
      checkout_time: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function returnStudent(checkoutId: string) {
  const { data, error } = await Bolt Database
    .from('checkout_log')
    .update({ return_time: new Date().toISOString() })
    .eq('id', checkoutId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getCheckoutHistory(limit = 50) {
  const { data, error } = await Bolt Database
    .from('checkout_log')
    .select(`
      *,
      students (
        id,
        name,
        student_id,
        grade
      )
    `)
    .order('checkout_time', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
}

export async function addStudent(name: string, studentId: string, grade: string) {
  const { data, error } = await Bolt Database
    .from('students')
    .insert({ name, student_id: studentId, grade })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteCheckoutRecord(checkoutId: string) {
  const { error } = await Bolt Database
    .from('checkout_log')
    .delete()
    .eq('id', checkoutId);
  
  if (error) throw error;
}
