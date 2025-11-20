import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type Destination = {
	id: string;
	name: string;
	is_active?: boolean;
	display_order?: number;
};

export type Student = {
	id: string;
	name: string;
	email: string;
	gender?: 'Male' | 'Female' | string;
	grade?: number | string;
	class_name?: string;
};

export type CurrentCheckout = {
	id: string;
	student_id?: string;
	checkout_time?: string;
	auto_return_at?: string;
	notes?: string | null;
	destination?: { name?: string } | string | null;
	students?: Student | null;
};

export type GenderAvailability = { male: boolean; female: boolean };

export type CheckoutLog = {
	id: string;
	student_id?: string;
	student_name?: string;
	student_email?: string;
	student_gender?: string;
	class_name?: string;
	destination_name?: string;
	action?: string;
	checkout_time?: string;
	checkin_time?: string | null;
	duration_minutes?: number | null;
	// optional helper fields used in UI
	students?: Student | null;
	destination?: string | { name?: string } | null;
	notes?: string | null;
};

export const supabase = createClient(String(supabaseUrl ?? ''), String(supabaseAnonKey ?? ''));
