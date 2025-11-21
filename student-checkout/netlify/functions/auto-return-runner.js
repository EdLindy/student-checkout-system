const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

function ensureClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE environment variables');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}

async function finalizeCheckout(supabase, checkout, action = 'AUTO') {
  if (!checkout?.student || !checkout.student.id) {
    throw new Error('Checkout is missing student relationship');
  }

  const checkoutTime = new Date(checkout.checkout_time);
  const checkinTime = new Date();
  const durationMinutes = Math.max(
    0,
    Math.round((checkinTime.getTime() - checkoutTime.getTime()) / 60000)
  );

  const destinationName = typeof checkout.destination === 'string'
    ? checkout.destination
    : checkout.destination?.name ?? null;

  const logInsert = await supabase.from('checkout_log').insert({
    student_id: checkout.student.id,
    student_name: checkout.student.name,
    student_email: checkout.student.email,
    student_gender: checkout.student.gender,
    class_name: checkout.student.class_name,
    destination_name: destinationName,
    action,
    checkout_time: checkout.checkout_time,
    checkin_time: checkinTime.toISOString(),
    duration_minutes: durationMinutes
  });

  if (logInsert.error) throw logInsert.error;

  const deleteOut = await supabase
    .from('checkout_log')
    .delete()
    .eq('student_id', checkout.student.id)
    .eq('checkout_time', checkout.checkout_time)
    .eq('action', 'OUT');

  if (deleteOut.error) throw deleteOut.error;

  const deleteCheckout = await supabase
    .from('current_checkouts')
    .delete()
    .eq('id', checkout.id);

  if (deleteCheckout.error) throw deleteCheckout.error;

  return durationMinutes;
}

exports.handler = async () => {
  let supabase;
  try {
    supabase = ensureClient();
  } catch (err) {
    console.error('Auto-return runner misconfigured:', err);
    return {
      statusCode: 200,
      body: JSON.stringify({ processed: 0, error: String(err) })
    };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('current_checkouts')
    .select('*, student:students(*), destination:destinations(name)')
    .not('auto_return_at', 'is', null)
    .lte('auto_return_at', nowIso);

  if (error) {
    console.error('Auto-return query failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ processed: 0, error: String(error.message || error) })
    };
  }

  let processed = 0;
  for (const checkout of data || []) {
    try {
      await finalizeCheckout(supabase, checkout, 'AUTO');
      processed += 1;
    } catch (err) {
      console.error('Failed to auto-return checkout', checkout?.id, err);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ processed, checkedAt: nowIso })
  };
};

exports.config = {
  schedule: '* * * * *'
};
