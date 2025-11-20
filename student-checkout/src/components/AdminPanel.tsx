import { useState } from 'react';
import { addStudent } from '../lib/checkout-service';
import { UserPlus, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import ActivityLog from './ActivityLog';

export default function AdminPanel() {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !studentId || !grade || !email) {
      alert('Name, student ID, grade and email are required');
      return;
    }

    setLoading(true);
    try {
      await addStudent(name, studentId, grade, email);
      setName('');
      setStudentId('');
      setGrade('');
      alert('Student added successfully!');
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
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let errorCount = 0;

      for (const rawRow of (jsonData as any[])) {
        try {
          const row: any = rawRow;
          const parsedName = row.name || row.Name || '';
          const parsedId = String(row.student_id || row.StudentID || row.ID || '').trim();
          const parsedGrade = String(row.grade || row.Grade || '').trim();
          const parsedEmail = String(row.email || row.Email || row.student_email || row.StudentEmail || '').trim();

          if (!parsedEmail) {
            throw new Error('Missing email for row');
          }

          await addStudent(parsedName, parsedId, parsedGrade, parsedEmail);
          successCount++;
        } catch (error) {
          console.error('Error adding student:', error);
          errorCount++;
        }
      }

      alert(`Upload complete!\nSuccess: ${successCount}\nFailed: ${errorCount}`);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Failed to process file');
    } finally {
      setUploading(false);
      e.target.value = '';
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
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Student ID
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="123456"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Grade
              </label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="9"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
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
              Upload an Excel file with columns: name, student_id, grade
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
              <p className="text-sm font-medium text-slate-700 mb-2">
                Excel Format Example:
              </p>
              <div className="bg-white border border-slate-200 rounded text-xs overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">name</th>
                      <th className="px-3 py-2 text-left">student_id</th>
                      <th className="px-3 py-2 text-left">grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 border-t">John Doe</td>
                      <td className="px-3 py-2 border-t">123456</td>
                      <td className="px-3 py-2 border-t">9</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border-t">Jane Smith</td>
                      <td className="px-3 py-2 border-t">123457</td>
                      <td className="px-3 py-2 border-t">10</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ActivityLog />
    </div>
  );
}
