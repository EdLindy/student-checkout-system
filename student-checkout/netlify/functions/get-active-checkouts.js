const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

function ensureClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE environment variables');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}

function shapeCurrentRow(row) {
  const student = row.student ?? null;
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
    students: student,
    destination,
    student_name: student?.name ?? row.student_name ?? null,
    class_name: student?.class_name ?? row.class_name ?? null,
    destination_name: destinationName
  };
}

function shapeLogRow(row) {
  const student = row.student ?? null;
  const destinationName = row.destination_name ?? null;

  return {
    id: row.id,
    checkout_time: row.checkout_time,
    auto_return_at: row.auto_return_at ?? null,
    notes: 'notes' in row ? row.notes ?? null : null,
    students: student,
    destination: destinationName ? { name: destinationName } : null,
    student_name: student?.name ?? row.student_name ?? null,
    class_name: student?.class_name ?? row.class_name ?? null,
    destination_name: destinationName
  };
}

async function fetchActiveCheckouts(client) {
  const { data, error } = await client
    .from('current_checkouts')
    .select('*, student:students(*), destination:destinations(*)')
    .order('checkout_time', { ascending: true });

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length > 0) {
    return rows.map(shapeCurrentRow);
  }

  const { data: logRows, error: logError } = await client
    .from('checkout_log')
    .select('*, student:students(*)')
    .eq('action', 'OUT')
    .is('checkin_time', null)
    .order('checkout_time', { ascending: true });

  if (logError) throw logError;
  return (logRows ?? []).map((row) => {
    // supabase returns joined column as "student"; ensure compatibility
    if (!row.student && row.students) {
      row.student = row.students;
    }
    const student = row.student ?? null;
    return shapeLogRow({
      ...row,
      student
    });
  });
}

exports.handler = async () => {
  try {
    const client = ensureClient();
    const rows = await fetchActiveCheckouts(client);
    return {
      statusCode: 200,
      body: JSON.stringify({ rows })
    };
  } catch (err) {
    console.error('get-active-checkouts failed', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err?.message || err) })
    };
  }
};
