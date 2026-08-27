'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { StaggerList, StaggerItem } from '@/components/motion/StaggerList';
import { dashboardTheme } from './theme';
import type { Task } from './types';

const STORAGE_KEY = 'talaba_tasks';
const DEFAULT_TASKS: Task[] = [
  { id: 1, text: 'Yotoqxona tozalik qoidalarini tekshirish', completed: true },
  { id: 2, text: "Xona to'lov chekini yuklash", completed: false },
];

/** Personal to-do list, persisted per-device in localStorage. Self-contained. */
export default function TasksCard({ isLight }: { isLight: boolean }) {
  const t = dashboardTheme(isLight);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
        return;
      } catch (e) {
        console.error('Failed to parse tasks:', e);
      }
    }
    setTasks(DEFAULT_TASKS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TASKS));
  }, []);

  const save = (next: Task[]) => {
    setTasks(next);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    save([...tasks, { id: Date.now(), text: newTask.trim(), completed: false }]);
    setNewTask('');
  };

  return (
    <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${t.surfaceBg}`}>
      <h3 className={`text-[10px] font-black mb-4 uppercase tracking-widest ${isLight ? 'text-amber-600' : 'text-yellow-400'}`}>
        Shaxsiy Vazifalarim
      </h3>

      <div className="flex gap-2 mb-4">
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Yangi vazifa..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') addTask();
          }}
          className={`flex-1 border rounded-xl px-4 py-3 text-xs outline-none transition-all ${
            isLight
              ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white'
              : 'bg-white/5 border-white/5 text-white placeholder:text-gray-500 focus:border-yellow-500/30'
          }`}
        />
        <button
          onClick={addTask}
          className={`px-4 rounded-xl transition-all ${
            isLight ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
          }`}
        >
          <Plus size={16} />
        </button>
      </div>

      <StaggerList className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {tasks.map((task) => (
          <StaggerItem key={task.id}>
            <div
              onClick={() => save(tasks.map((x) => (x.id === task.id ? { ...x, completed: !x.completed } : x)))}
              className={`flex items-center gap-3 p-3 border rounded-2xl cursor-pointer group transition-all duration-200 ${
                isLight ? 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm' : 'bg-white/5 border-white/5 hover:bg-white/10'
              }`}
            >
              <div className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                task.completed
                  ? 'bg-green-500 text-white shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                  : isLight ? 'bg-slate-50 border border-slate-300' : 'bg-white/5 border border-white/10'
              }`}>
                {task.completed && <CheckCircle2 size={10} className="text-white" />}
              </div>

              <span className={`flex-1 text-xs font-semibold transition-all ${
                task.completed ? 'line-through text-slate-400 italic' : t.textStrong
              }`}>
                {task.text}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  save(tasks.filter((x) => x.id !== task.id));
                }}
                className={`opacity-0 group-hover:opacity-100 p-1 transition-opacity ${
                  isLight ? 'text-slate-400 hover:text-red-600' : 'text-gray-500 hover:text-red-400'
                }`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </StaggerItem>
        ))}
        {tasks.length === 0 && (
          <p className={`text-xs text-center py-6 ${t.textMuted} italic`}>Hozircha vazifalar yo&apos;q.</p>
        )}
      </StaggerList>
    </div>
  );
}
