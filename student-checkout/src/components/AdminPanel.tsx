import { useState, useEffect } from 'react';
import {
  addStudent,
  getClassesWithStudents,
  CheckoutService,
  deleteStudentsByIds,
  deleteClassRoster,
  deleteAllClasses,
  normalizeRosterGenders,
  normalizeGender,
  type ClassGroup
} from '../lib/checkout-service';
import { UserPlus, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import ActivityLog from './ActivityLog';

export default function AdminPanel() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [normalizingGenders, setNormalizingGenders] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [deletingStudents, setDeletingStudents] = useState(false);
  const [deletingClassName, setDeletingClassName] = useState<string | null>(null);
  const [clearingAllClasses, setClearingAllClasses] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    setClassesLoading(true);
    try {
      const data = await getClassesWithStudents();
      setClasses(data);
      setSelectedStudentIds(new Set());
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setClassesLoading(false);
    }
  }

  const toggleStudentSelection = (studentId: string) => {
    if (!studentId) return;
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const applyClassSelection = (studentIds: string[], shouldSelect: boolean) => {
    if (!studentIds.length) return;
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      studentIds.forEach((id) => {
        if (!id) return;
        if (shouldSelect) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  };

  async function handleDeleteSelectedStudents(studentIds: string[]) {
    if (!studentIds.length) return;
    if (!confirm(`Delete ${studentIds.length} selected student${studentIds.length === 1 ? '' : 's'}?`)) return;
    setDeletingStudents(true);
    try {
      const removed = await deleteStudentsByIds(studentIds);
      alert(`${removed} student${removed === 1 ? '' : 's'} deleted.`);
      const nextSelection = new Set(selectedStudentIds);
      studentIds.forEach((id) => nextSelection.delete(id));
      setSelectedStudentIds(nextSelection);
      await loadClasses();
    } catch (error) {
      console.error('Failed to delete selected students', error);
      alert('Failed to delete selected students.');
    } finally {
      setDeletingStudents(false);
    }
  }

  async function handleDeleteClass(className: string) {
    if (!className || !confirm(`Delete the entire roster for ${className}?`)) return;
    setDeletingClassName(className);
    try {
      const removed = await deleteClassRoster(className);
      alert(`${removed} student${removed === 1 ? '' : 's'} removed from ${className}.`);
      await loadClasses();
    } catch (error) {
      console.error('Failed to delete class roster', error);
      alert('Failed to delete class roster.');
    } finally {
      setDeletingClassName(null);
    }
  }

  async function handleDeleteAllClasses() {
    if (!classes.length) return;
    if (!confirm('Delete all classes and students? This cannot be undone.')) return;
    setClearingAllClasses(true);
    try {
      const removed = await deleteAllClasses();
      alert(`${removed} student${removed === 1 ? '' : 's'} deleted across all classes.`);
      await loadClasses();
    } catch (error) {
      console.error('Failed to delete all classes', error);
      alert('Failed to delete all classes.');
    } finally {
      setClearingAllClasses(false);
    }
  }

  async function handleForceCheckIn() {
    if (resetting) return;
    if (!confirm('Check all students back in? This will close every active checkout.')) {
      return;
    }

    setResetting(true);
    try {
      const result = await CheckoutService.resetSystem();
      alert(result.message);
      await loadClasses();
    } catch (error) {
      console.error('Error resetting system:', error);
      alert('Failed to check all students in.');
    } finally {
      setResetting(false);
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !gender || !className) {
      alert('Name, email, gender, and class are required');
      return;
    }

    setLoading(true);
    try {
      await addStudent(name, email, gender || null, className || null);
      setName('');
      setGender('');
      setClassName('');
      alert('Student added successfully!');
      await loadClasses();
    } catch (error) {
      console.error('Error adding student:', error);
      alert('Failed to add student');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    let shouldReloadClasses = false;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      let successCount = 0;
      let errorCount = 0;

      const sheetAsObjects = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        blankrows: false
      }) as Record<string, string | number | null>[];

      const fromHeaders = sheetAsObjects
        .map((row) => {
          const parsedName = String(
            row['Student Name'] ||
              row['student_name'] ||
              row['name'] ||
              row['Name'] ||
              ''
          ).trim();
          const parsedEmail = String(
            row['Email'] ||
              row['email'] ||
              row['EmailAddress'] ||
              row['StudentEmail'] ||
              ''
          ).trim();
          const parsedClass = String(
            row['Class'] ||
              row['class'] ||
              row['ClassName'] ||
              row['class_name'] ||
              ''
          ).trim();
          const parsedGenderRaw = String(
            row['Gender'] ||
              row['gender'] ||
              row['Gender ' /* stray space */] ||
              ''
          ).trim();
          return {
            student: parsedName,
            email: parsedEmail,
            class: parsedClass,
            gender: normalizeGender(parsedGenderRaw) ?? ''
          };
        })
        .filter((row) => row.student || row.email || row.class || row.gender);

      const rowsFromHeaders = fromHeaders.filter((row) => row.student && row.email);

      const positionalRows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        blankrows: false,
        defval: ''
      }) as (string | number | null)[][];

      const looksLikeHeader = (row: (string | number | null)[] | undefined) => {
        if (!row) return false;
        const headerText = row.map((cell) => String(cell ?? '').trim().toLowerCase());
        return (
          headerText.includes('student name') ||
          headerText.includes('email') ||
          headerText.includes('class')
        );
      };

      const rawRows = looksLikeHeader(positionalRows[0])
        ? positionalRows.slice(1)
        : positionalRows;

      const rowsFromPositions = rawRows
        .map((cells) => cells.map((cell) => String(cell ?? '').trim()))
        .filter((cells) => cells.some((value) => value.length > 0))
        .map((cells) => {
          const parsedName = cells[0] ?? '';
          const parsedEmail = cells[1] ?? '';
          const parsedClass = cells[2] ?? '';
          const parsedGenderRaw = cells[3] ?? '';
          return {
            student: parsedName,
            email: parsedEmail,
            class: parsedClass,
            gender: normalizeGender(parsedGenderRaw) ?? ''
          };
        });

      const rows = rowsFromHeaders.length > 0 ? rowsFromHeaders : rowsFromPositions;

      // Server-side validation + insertion
      const validateRes = await fetch('/.netlify/functions/validate-bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, insert: true })
      });

      if (!validateRes.ok) {
        console.error('Validation function failed');
        alert('Failed to validate upload. See console for details.');
        return;
      }

      const { valid, invalid, insertResult } = await validateRes.json();

      // Report invalid rows
      if (invalid && invalid.length > 0) {
        const msg = `Validation: ${valid.length} valid, ${invalid.length} invalid.\nFirst errors:\n` + invalid.slice(0,5).map((i:any)=>`Row ${i.index+1}: ${i.reason}`).join('\n');
        if (!confirm(msg + '\n\nProceed with valid rows only?')) {
          setUploading(false);
          e.target.value = '';
          return;
        }
      }

      // If server performed insertion, use its result
      if (insertResult) {
        if (insertResult.error) {
          console.error('Insertion error:', insertResult.error);
          alert('Upload validated but insertion failed on server. See console for details.');
        } else {
          const inserted = insertResult.inserted || (insertResult.data ? insertResult.data.length : 0);
          alert(`Upload complete!\nValidated: ${valid.length}\nInserted/Upserted: ${inserted}\nInvalid: ${invalid.length}`);
          shouldReloadClasses = true;
        }
      } else {
        // Fallback: if server didn't insert, insert client-side
        for (const row of valid) {
          try {
            await addStudent(row.student, row.email, row.gender, row.class);
            successCount++;
          } catch (err) {
            console.error('Error adding student:', err);
            errorCount++;
          }
        }
        alert(`Upload complete!\nSuccess: ${successCount}\nFailed: ${errorCount}`);
        if (successCount > 0) {
          shouldReloadClasses = true;
        }
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Failed to process file');
    } finally {
      setUploading(false);
      e.target.value = '';
    }

    if (shouldReloadClasses) {
      await loadClasses();
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center mb-6">
            <UserPlus className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-slate-800">Add Student</h2>
          </div>

          <form onSubmit={handleAddStudent} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@school.org"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" required>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Class</label>
              <input type="text" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="9A" className="w-full px-4 py-2 border border-slate-300 rounded-lg" required />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Adding...' : 'Add Student'}
            </button>
          </form>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center mb-6">
            <Upload className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-slate-800">Bulk Upload</h2>
          </div>

          <div className="space-y-4">
            <p className="text-slate-600">
              Upload an Excel (.xlsx) file with columns in this order: <strong>Column A:</strong> Student Name, <strong>Column B:</strong> Email, <strong>Column C:</strong> Class, <strong>Column D:</strong> Gender (Male or Female)
            </p>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <label className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-700 font-medium">
                  Choose Excel file
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {uploading && (
                <p className="mt-2 text-sm text-slate-500">Uploading...</p>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Excel Format Example:</p>
               <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-slate-500">Download a sample CSV to use as a template.</div>
                  <button
                    type="button"
                    onClick={() => {
                      const csv = 'Student Name,Email,Class,Gender\nJohn Doe,jdoe@spx.org,9A,Male\nJane Smith,jsmith@spx.org,10B,Female\n';
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'students-sample.csv';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Download Sample CSV
                  </button>
               </div>
              <div className="bg-white border border-slate-200 rounded text-xs overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Student Name</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Gender</th>
                      <th className="px-3 py-2 text-left">Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 border-t">John Doe</td>
                      <td className="px-3 py-2 border-t">jdoe@spx.org</td>
                      <td className="px-3 py-2 border-t">Male</td>
                      <td className="px-3 py-2 border-t">9A</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border-t">Jane Smith</td>
                      <td className="px-3 py-2 border-t">jsmith@spx.org</td>
                      <td className="px-3 py-2 border-t">Female</td>
                      <td className="px-3 py-2 border-t">10B</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">System Controls</h3>
            <p className="text-sm text-slate-500">Bring every student back in instantly.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleForceCheckIn}
              disabled={resetting}
              className="px-5 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {resetting ? 'Checking everyone in…' : 'Force Check-In All'}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm('Normalize all stored gender values using the latest rules?')) return;
                setNormalizingGenders(true);
                try {
                  const result = await normalizeRosterGenders();
                  alert(`Normalization complete. ${result.updated} of ${result.total} students updated.`);
                  await loadClasses();
                } catch (error) {
                  console.error('Failed to normalize roster genders', error);
                  alert('Failed to normalize genders. See console for details.');
                } finally {
                  setNormalizingGenders(false);
                }
              }}
              disabled={normalizingGenders}
              className="px-5 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 disabled:bg-slate-200 disabled:text-slate-500"
            >
              {normalizingGenders ? 'Normalizing…' : 'Normalize Genders'}
            </button>
          </div>
        </div>
      </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Room 305 Classes</h2>
              <p className="text-sm text-slate-500">Each class expands to show every student included in the roster.</p>
            </div>
            <button
              type="button"
              onClick={loadClasses}
              disabled={classesLoading}
              className="self-start sm:self-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {classesLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={handleDeleteAllClasses}
              disabled={clearingAllClasses || classes.length === 0}
              className="self-start sm:self-auto px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 disabled:bg-slate-200 disabled:text-slate-500"
            >
              {clearingAllClasses ? 'Deleting all…' : 'Delete All Classes'}
            </button>
          </div>

          {classesLoading ? (
            <div className="text-slate-500">Loading classes...</div>
          ) : classes.length === 0 ? (
            <div className="text-slate-500">Add students to start building class rosters.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {classes.map((classGroup) => {
                const label = classGroup.className || 'Unassigned';
                const isExpanded = expandedClass === label;
                return (
                  <div key={label} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedClass(isExpanded ? null : label)}
                        className="flex-1 text-left"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{label}</p>
                          <p className="text-sm text-slate-500">{classGroup.students.length} {classGroup.students.length === 1 ? 'student' : 'students'}</p>
                        </div>
                        <span className="text-xl text-slate-500 font-mono">{isExpanded ? '-' : '+'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(label)}
                        disabled={deletingClassName === label}
                        className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {deletingClassName === label ? 'Deleting…' : 'Delete Class'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-2">
                        {(() => {
                          const selectableIds = classGroup.students
                            .map((student) => student.id ?? '')
                            .filter((id): id is string => Boolean(id));
                          const selectedCount = selectableIds.filter((id) => selectedStudentIds.has(id)).length;
                          return (
                            <div className="mb-3 flex flex-wrap gap-2 items-center">
                              <span className="text-sm text-slate-600">
                                {selectedCount} selected
                              </span>
                              <button
                                type="button"
                                onClick={() => applyClassSelection(selectableIds, true)}
                                disabled={!selectableIds.length}
                                className="px-3 py-1 text-sm bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={() => applyClassSelection(selectableIds, false)}
                                disabled={!selectedCount}
                                className="px-3 py-1 text-sm bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
                              >
                                Clear Selection
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSelectedStudents(selectableIds.filter((id) => selectedStudentIds.has(id)))}
                                disabled={!selectedCount || deletingStudents}
                                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-slate-300"
                              >
                                {deletingStudents ? 'Deleting…' : 'Delete Selected'}
                              </button>
                            </div>
                          );
                        })()}

                        {classGroup.students.map((student) => {
                          const studentId = student.id ?? '';
                          const isSelected = studentId ? selectedStudentIds.has(studentId) : false;
                          return (
                            <label
                              key={student.id ?? student.email}
                              className="bg-slate-50 rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                disabled={!studentId}
                                checked={isSelected}
                                onChange={() => toggleStudentSelection(studentId)}
                                className="h-4 w-4 text-blue-600 border-slate-300 rounded"
                              />
                              <div>
                                <p className="font-medium text-slate-800">{student.name}</p>
                                <p className="text-sm text-slate-500">{student.email}</p>
                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                  {student.gender ? `Gender: ${student.gender}` : 'Gender missing'}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      <ActivityLog />
    </div>
  );
}
