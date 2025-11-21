const { createClient } = (() => {
  try {
    return require('@supabase/supabase-js');
  } catch (e) {
    return {};
  }
})();

exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const rows = Array.isArray(body) ? body : (body.rows || []);

    const valid = [];
    const invalid = [];

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    rows.forEach((r, idx) => {
      const student = (r.student || '').toString().trim();
      const email = (r.email || '').toString().trim().toLowerCase();
      let gender = (r.gender || '').toString().trim();
      const className = (r.class || r.class_name || '').toString().trim();

      if (!student) {
        invalid.push({ index: idx, reason: 'Missing student name' });
        return;
      }

      if (!email || !emailRegex.test(email)) {
        invalid.push({ index: idx, reason: 'Invalid or missing email' });
        return;
      }

      if (!gender) {
        invalid.push({ index: idx, reason: 'Missing gender' });
        return;
      }

      gender = gender[0].toUpperCase() + gender.slice(1).toLowerCase();
      if (!['Male', 'Female'].includes(gender)) {
        invalid.push({ index: idx, reason: `Invalid gender: ${gender}` });
        return;
      }

      if (!className) {
        invalid.push({ index: idx, reason: 'Missing class' });
        return;
      }

      valid.push({ student, email, gender, class: className, index: idx });
    });

    // If requested, perform server-side insertion using Supabase service role
    let insertResult = null;
    if (body.insert && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE && createClient) {
      try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
        // Map valid rows to students payload
        const payload = valid.map((v) => ({
          name: v.student,
          email: v.email,
          gender: v.gender,
          class_name: v.class,
          // keep student_id/grade empty for bulk import format
        }));

        // Use upsert on email to avoid duplicates
        const { data, error } = await supabase.from('students').upsert(payload, { onConflict: ['email'] });
        if (error) {
          insertResult = { error: String(error) };
        } else {
          insertResult = { inserted: data ? data.length : 0, data };
        }
      } catch (err) {
        insertResult = { error: String(err) };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ valid, invalid, insertResult })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
