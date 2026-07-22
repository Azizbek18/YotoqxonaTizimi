"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Search, X, Plus, CreditCard, Trash2, CheckCircle2,
  Megaphone, MapPin, User, FileText, AlertTriangle,
  Sparkles, ArrowRight, Phone, Heart, Calendar, Clock, ClipboardList, CheckCircle,
  MessageSquare
} from 'lucide-react';
import { useThemeStore } from '@/lib/stores/theme-store';
import { supabase } from '@/lib/supabase';
import { getSafeUser } from '@/lib/auth-session';
import ProfileLoadError from '@/components/talaba/ProfileLoadError';
import CustomSelect from '@/components/ui/CustomSelect';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { fetchStudentPayments } from '@/features/payments/client/api';
import { fetchStudentProfile } from '@/features/profile/client/api';
import { fetchStudentAnnouncements } from '@/features/announcements/client/api';
import { fetchCleaningSchedule, saveCleaningSchedule } from '@/features/duty/client/cleaning-api';
import {
  createStudentApplication,
  fetchStudentApplications,
} from '@/features/applications/client/api';


interface Task {
  id: number;
  text: string;
  completed: boolean;
}

interface Ariza {
  id: string | number;
  ism: string;
  kurs: string;
  yonalish: string;
  sana: string;
  matn: string;
  daraja: 'warning' | 'danger' | 'info';
}

interface Elon {
  id: string | number;
  title: string;
  type: 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish';
  teacher: string;
  room: string;
  time: string;
  desc: string;
}

interface Elon {
  id: string | number;
  title: string;
  type: 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish';
  teacher: string;
  room: string;
  time: string;
  desc: string;
  is_from_captain?: boolean;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  phone_number?: string;
  faculty?: string;
  role?: string;
  room_number?: string;
  course?: string | number;
  group?: string | number;
  avatar_url?: string;
  is_floor_captain?: boolean;
  assigned_floor?: number;
  gender?: string;
  warning_count?: number;
}

interface PaymentRecord {
  id?: string | number;
  month?: string;
  year?: number;
  amount: number;
  status: string;
  created_at?: string;
}

interface MyApplication {
  id: string | number;
  type: 'ariza' | 'tushuntirish';
  title: string;
  createdDate: string;
  status: 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected';
}

type AdminChatMessage = {
  id?: string | number;
  title?: string;
  text?: string;
  reason?: string;
  status?: string;
  created_at?: string;
  date?: string;
  sender_role?: string;
}

function toAdminChatMessage(application: {
  id: string;
  title: string | null;
  text: string;
  reason: string | null;
  status: string | null;
  created_at: string;
  date: string | null;
}) : AdminChatMessage {
  return {
    id: application.id,
    title: application.title ?? undefined,
    text: application.text,
    reason: application.reason ?? undefined,
    status: application.status ?? undefined,
    created_at: application.created_at,
    date: application.date ?? undefined,
    sender_role: application.title ?? undefined,
  };
}

function formatElonDate(value: string | null | undefined) {
  if (!value) return 'Bugun';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Bugun';
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Bugun';
  if (diffDays === 1) return 'Kecha';
  if (diffDays < 7) return `${diffDays} kun avval`;
  return date.toLocaleDateString('uz-UZ');
}

const ChatMarkdownMessage = React.memo(({ text }: { text: string }) => {
  const html = useMemo(() => {
    return DOMPurify.sanitize(String(marked.parse(text, { async: false })), {
      USE_PROFILES: { html: true },
    })
  }, [text])
  return (
    <div 
      className="break-words space-y-1 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-blue-500 [&_a]:underline [&_p]:my-1 [&_code]:bg-slate-200/50 [&_code]:dark:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono"
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  )
})
ChatMarkdownMessage.displayName = 'ChatMarkdownMessage'

export default function TalabaDashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  interface CaptainInfo {
    full_name: string;
    phone_number?: string;
    email?: string;
  }

  // State - Profile va Roommates
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roommates, setRoommates] = useState<Profile[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [floorCaptain, setFloorCaptain] = useState<CaptainInfo | null>(null);


  // State - UI
  const [showArizalar, setShowArizalar] = useState(false);
  const [selectedElon, setSelectedElon] = useState<Elon | null>(null);
  const [selectedAriza, setSelectedAriza] = useState<Ariza | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [elonCategory, setElonCategory] = useState<string>("Barchasi");

  // State - Cleaning Duty
  const [cleaningDone, setCleaningDone] = useState(false);

  // State - Theme
  const theme = useThemeStore((state) => state.theme);
  const isLight = theme === 'light';

  // State - Tasks (Persisted)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");

  // State - Dynamic Data
  const [elonlar, setElonlar] = useState<Elon[]>([]);
  const [arizalar, setArizalar] = useState<Ariza[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [adminChatMessages, setAdminChatMessages] = useState<AdminChatMessage[]>([]);
  const [loadingAdminChat, setLoadingAdminChat] = useState(false);
  const [sendingAdminChat, setSendingAdminChat] = useState(false);
  const [adminChatInput, setAdminChatInput] = useState('');

  const getAppStatusInfo = (status: string) => {
    switch (status) {
      case 'draft':
        return {
          label: 'Qoralama (Draft)',
          badgeClass: isLight 
            ? 'text-slate-600 bg-slate-100 border-slate-200' 
            : 'text-slate-400 bg-slate-500/10 border-slate-500/20',
          icon: FileText
        };
      case 'submitted':
      case 'pending':
        return {
          label: 'Ko\'rib chiqilmoqda',
          badgeClass: isLight 
            ? 'text-amber-600 bg-amber-50 border-amber-200' 
            : 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: Clock
        };
      case 'approved':
        return {
          label: 'Qabul qilindi',
          badgeClass: isLight 
            ? 'text-emerald-600 bg-emerald-50 border-emerald-200' 
            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          icon: CheckCircle2
        };
      case 'rejected':
        return {
          label: 'Rad etildi',
          badgeClass: isLight 
            ? 'text-rose-600 bg-rose-50 border-rose-200' 
            : 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          icon: AlertTriangle
        };
      default:
        return {
          label: status,
          badgeClass: isLight 
            ? 'text-slate-600 bg-slate-100 border-slate-200' 
            : 'text-slate-400 bg-slate-500/10 border-slate-500/20',
          icon: FileText
        };
    }
  };

  const allResidents = useMemo(() => {
    if (!profile) return [];
    const list = [
      { id: profile.id, name: `${profile.full_name} (Siz)`, isSelf: true }
    ];
    roommates.forEach(r => {
      list.push({ id: r.id, name: r.full_name, isSelf: false });
    });
    return list;
  }, [profile, roommates]);

  // States for interactive cleaning duty schedule
  const [cleaningSchedule, setCleaningSchedule] = useState<Record<string, { id: string; name: string } | null>>({});
  const [draftSchedule, setDraftSchedule] = useState<Record<string, { id: string; name: string } | null>>({});
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [activeDragOverDay, setActiveDragOverDay] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const WEEKDAYS = useMemo(() => [
    "Dushanba",
    "Seshanba",
    "Chorshanba",
    "Payshanba",
    "Juma",
    "Shanba",
    "Yakshanba"
  ], []);

  const todayName = useMemo(() => {
    const days = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
    const todayIdx = new Date().getDay();
    return days[todayIdx];
  }, []);

  const todayDutyPerson = useMemo(() => {
    return cleaningSchedule[todayName] || null;
  }, [cleaningSchedule, todayName]);


  const getDefaultSchedule = (residents: Array<{ id: string; name: string; isSelf: boolean }>) => {
    const defaultSched: Record<string, { id: string; name: string } | null> = {};
    const WEEKDAYS_LIST = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
    WEEKDAYS_LIST.forEach((day, idx) => {
      if (residents.length > 0) {
        const resident = residents[idx % residents.length];
        defaultSched[day] = { id: resident.id, name: resident.name };
      } else {
        defaultSched[day] = null;
      }
    });
    return defaultSched;
  };

  // Load cleaning schedule
  useEffect(() => {
    if (!profile || !profile.room_number || allResidents.length === 0) return;

    async function loadSchedule() {
      const roomNum = profile!.room_number!;
      try {
        const { schedule } = await fetchCleaningSchedule();

        if (schedule) {
          setCleaningSchedule(schedule);
          return;
        }
      } catch {
        // Table may not exist yet — fall back to localStorage below.
      }

      // Check localStorage
      const localSaved = localStorage.getItem(`cleaning_schedule_${roomNum}`);
      if (localSaved) {
        try {
          setCleaningSchedule(JSON.parse(localSaved));
          return;
        } catch (e) {
          console.error("Local storage schedule parse error:", e);
        }
      }

      // Default schedule fallback
      const defaultSched = getDefaultSchedule(allResidents);
      setCleaningSchedule(defaultSched);
    }

    loadSchedule();
  }, [profile, roommates, allResidents]);

  // Sync draft with confirmed schedule when modal opens
  useEffect(() => {
    if (isScheduleModalOpen) {
      setDraftSchedule({ ...cleaningSchedule });
      setSelectedResidentId(null);
      setActiveDragOverDay(null);
    }
  }, [isScheduleModalOpen, cleaningSchedule]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = isScheduleModalOpen || !!selectedElon || !!selectedAriza || showArizalar || isChatModalOpen;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isScheduleModalOpen, selectedElon, selectedAriza, showArizalar, isChatModalOpen]);

  const loadChatMessages = async () => {
    try {
      setLoadingAdminChat(true);
      const { applications } = await fetchStudentApplications('chat');
      setAdminChatMessages((applications || []).map(toAdminChatMessage));
    } catch (error) {
      console.error('Chat yuklashda xatolik:', error);
    } finally {
      setLoadingAdminChat(false);
    }
  };

  useEffect(() => {
    if (profile && isChatModalOpen) {
      void loadChatMessages();
    }
  }, [profile, isChatModalOpen]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !adminChatInput.trim() || sendingAdminChat) return;

    const messageText = adminChatInput.trim();
    setAdminChatInput('');
    setSendingAdminChat(true);

    try {
      const { application } = await createStudentApplication({
          type: 'chat',
          title: 'talaba',
          reason: messageText,
          status: 'submitted',
          text: messageText,
          level: 'info',
        });
      setAdminChatMessages(prev => [...prev, toAdminChatMessage(application)]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Xabar yuborishda xatolik';
      toast.error(message);
      setAdminChatInput(messageText);
    } finally {
      setSendingAdminChat(false);
    }
  };

  // Drag start handler
  const handleDragStart = (e: React.DragEvent, residentId: string) => {
    e.dataTransfer.setData("text/plain", residentId);
    e.dataTransfer.effectAllowed = "move";
  };

  // Drag over target
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Drag enter target
  const handleDragEnter = (e: React.DragEvent, day: string) => {
    e.preventDefault();
    setActiveDragOverDay(day);
  };

  // Drag leave target
  const handleDragLeave = (e: React.DragEvent, day: string) => {
    e.preventDefault();
    if (activeDragOverDay === day) {
      setActiveDragOverDay(null);
    }
  };

  // Drop handler
  const handleDrop = (e: React.DragEvent, day: string) => {
    e.preventDefault();
    setActiveDragOverDay(null);
    const residentId = e.dataTransfer.getData("text/plain");
    const resident = allResidents.find(r => r.id === residentId);
    if (resident) {
      setDraftSchedule(prev => ({
        ...prev,
        [day]: { id: resident.id, name: resident.name }
      }));
    }
  };

  // Click handler for click-to-assign
  const handleResidentClick = (residentId: string) => {
    if (selectedResidentId === residentId) {
      setSelectedResidentId(null);
    } else {
      setSelectedResidentId(residentId);
    }
  };

  const handleDayClick = (day: string) => {
    if (selectedResidentId) {
      const resident = allResidents.find(r => r.id === selectedResidentId);
      if (resident) {
        setDraftSchedule(prev => ({
          ...prev,
          [day]: { id: resident.id, name: resident.name }
        }));
        setSelectedResidentId(null);
      }
    }
  };

  // Reset draft to sequential default
  const handleResetDraft = () => {
    const defaultSched = getDefaultSchedule(allResidents);
    setDraftSchedule(defaultSched);
    toast.success("Jadval standart holatga qaytarildi");
  };

  // Save the schedule to DB/localStorage
  const handleSaveSchedule = async () => {
    if (!profile || !profile.room_number) return;
    setIsSavingSchedule(true);
    const roomNum = profile.room_number;
    try {
      await saveCleaningSchedule(draftSchedule);

      setCleaningSchedule(draftSchedule);
      localStorage.setItem(`cleaning_schedule_${roomNum}`, JSON.stringify(draftSchedule));
      toast.success("Navbatchilik jadvali muvaffaqiyatli saqlandi!");
      setIsScheduleModalOpen(false);
    } catch (err) {
      console.warn("Supabase upsert failed, saving to localStorage as fallback:", err);
      // Fallback
      setCleaningSchedule(draftSchedule);
      localStorage.setItem(`cleaning_schedule_${roomNum}`, JSON.stringify(draftSchedule));
      toast.success("Navbatchilik jadvali qurilmada saqlandi (mahalliy rejim)!");
      setIsScheduleModalOpen(false);
    } finally {
      setIsSavingSchedule(false);
    }
  };


  // State - AI Chatbot
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'model'; text: string }>>([
    {
      role: 'model',
      text: "Salom! Men yotoqxona AI yordamchisiman. Yotoqxona qoidalari, to'lovlar, komendant telefon raqami yoki tozalik navbatchiligi bo'yicha qanday savolingiz bor? 😊"
    }
  ]);
  const [userMessage, setUserMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || userMessage;
    if (!messageText.trim() || chatLoading) return;

    const newMsg = { role: 'user' as const, text: messageText };
    const updatedMessages = [...chatMessages, newMsg];
    setChatMessages(updatedMessages);
    setUserMessage("");
    setChatLoading(true);

    try {
      const { data: { session: chatSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(chatSession?.access_token ? { Authorization: `Bearer ${chatSession.access_token}` } : {})
        },
        body: JSON.stringify({
          message: messageText,
          history: chatMessages.slice(-10)
        })
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages(prev => [...prev, { role: 'model' as const, text: data.reply }]);
      } else {
        throw new Error(data.error || "Tahlil qilishda xato");
      }
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, {
        role: 'model' as const,
        text: "Kechirasiz, javob olishda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring. 🔌"
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Load Tasks and Settings on Mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('talaba_tasks');
      if (saved) {
        try {
          setTasks(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse tasks:", e);
        }
      } else {
        const defaultTasks = [
          { id: 1, text: "Yotoqxona tozalik qoidalarini tekshirish", completed: true },
          { id: 2, text: "Xona to'lov chekini yuklash", completed: false }
        ];
        setTasks(defaultTasks);
        localStorage.setItem('talaba_tasks', JSON.stringify(defaultTasks));
      }

      // Load Cleaning Duty Status
      const savedCleaning = localStorage.getItem('room_cleaning_done');
      const savedCleaningDate = localStorage.getItem('room_cleaning_date');
      const todayStr = new Date().toDateString();

      if (savedCleaningDate === todayStr) {
        setCleaningDone(savedCleaning === 'true');
      } else {
        setCleaningDone(false);
        localStorage.setItem('room_cleaning_done', 'false');
        localStorage.setItem('room_cleaning_date', todayStr);
      }
    }
  }, []);

  // Save Tasks Helper
  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    if (typeof window !== 'undefined') {
      localStorage.setItem('talaba_tasks', JSON.stringify(newTasks));
    }
  };

  // Toggle Cleaning status
  const handleCleaningToggle = () => {
    const nextVal = !cleaningDone;
    setCleaningDone(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('room_cleaning_done', String(nextVal));
    }
  };

  // Fetch Profile, Roommates, Announcements, and Disciplinary Writeups
  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingProfile(true);
        const user = await getSafeUser();

        let currentProfile: Profile | null = null;

        if (user) {
          // 1. Profil ma'lumotlarini olish
          const profilePayload = await fetchStudentProfile();
          const profileData = profilePayload.profile;
          const profileError = !profileData;

          if (!profileError && profileData) {
            currentProfile = profileData as Profile;
            setProfile(currentProfile);

            setRoommates((profilePayload.roommates ?? []) as Profile[]);

            // 2b. Qavat sardorini yuklash
            if (profilePayload.floorCaptain) {
              setFloorCaptain({
                full_name: profilePayload.floorCaptain.full_name ?? '',
                phone_number: profilePayload.floorCaptain.phone_number ?? undefined,
                email: profilePayload.floorCaptain.email ?? undefined,
              });
            }
          }
        }

        if (!currentProfile) {
          setProfileError(true);
        }

        // Steps 3-5 load supplementary data (announcements, warnings, payments).
        // A failure here must never hide an already-loaded profile behind the
        // fatal error screen, so each step is isolated in its own try/catch.

        // 3. Real E'lonlarni Yuklash (API orqali filterlangan holda)
        try {
          const resultElon = await fetchStudentAnnouncements();

          if (Array.isArray(resultElon.elonlar)) {
            const mappedElons = resultElon.elonlar.map((e) => ({
              id: e.id,
              title: e.title,
              type: e.type,
              teacher: e.author_name || "Tizim ma'muri",
              room: e.is_from_captain ? `${e.captain_floor}-qavat sardori` : "Ma'muriyat",
              time: formatElonDate(e.published_at ?? e.created_at),
              desc: e.text,
              is_from_captain: e.is_from_captain,
            }));
            setElonlar(mappedElons);
          } else {
            setElonlar([]);
          }
        } catch (elonError) {
          console.error("E'lonlarni yuklashda xato:", elonError);
          setElonlar([]);
        }

        // 4. Real Arizalar / Ogohlantirishlarni Yuklash (arizalar table)
        try {
          if (currentProfile && currentProfile.full_name) {
            const { applications: arizalarData } = await fetchStudentApplications('warnings');

            if (arizalarData && arizalarData.length > 0) {
              const mappedArizalar = arizalarData.map((a) => ({
                id: a.id,
                ism: a.student_name ?? currentProfile.full_name,
                kurs: currentProfile?.course ? `${currentProfile.course}-kurs` : "—",
                yonalish: currentProfile?.faculty || "—",
                sana: a.created_at ? new Date(a.created_at).toLocaleDateString('uz-UZ') : '—',
                matn: a.text,
                daraja: (a.level === 'critical' ? 'danger' : a.level === 'warning' ? 'warning' : 'info') as Ariza['daraja'],
              }));
              setArizalar(mappedArizalar);
            } else {
              setArizalar([]);
            }
          }
        } catch (arizaError) {
          console.error('Arizalarni yuklashda xato:', arizaError);
          setArizalar([]);
        }

        // 4b. Real Murojaat va Arizalarim Statusini Yuklash (arizalar table)
        try {
          if (user) {
            const { applications: myAppsData } = await fetchStudentApplications('documents', 3);

            if (myAppsData && myAppsData.length > 0) {
              const mappedMyApps = myAppsData.map((app) => ({
                id: app.id,
                type: (app.type || 'ariza') as 'ariza' | 'tushuntirish',
                title: app.title || 'Sarlavhasiz',
                createdDate: app.date || app.created_at || new Date().toISOString(),
                status: (app.status || 'pending') as 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected',
              }));
              setMyApplications(mappedMyApps);
            } else {
              setMyApplications([]);
            }
          } else {
            setMyApplications([]);
          }
        } catch (myAppsCatchError) {
          console.error('Murojaatlarni yuklashda xato:', myAppsCatchError);
          setMyApplications([]);
        }

        // 5. Real Tolovlarni Yuklash (tolovlar table)
        try {
          if (user) {
            setPayments(await fetchStudentPayments());
          }
        } catch (tolovCatchError) {
          console.error("To'lovlarni yuklashda xato:", tolovCatchError);
        }

      } catch (error) {
        console.error('Ma\'lumotlarni yuklashda xato:', error);
        setProfileError(true);
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchData();
  }, []);

  const arizaSoni = typeof profile?.warning_count === 'number' ? Math.max(profile.warning_count, arizalar.length) : arizalar.length;
  // Calculate health metrics
  const maxWarnings = 3;
  const healthPercent = Math.max(0, Math.min(100, Math.round(((maxWarnings - arizaSoni) / maxWarnings) * 100)));
  const healthColor = healthPercent >= 100 ? 'bg-emerald-500 shadow-emerald-500/30' :
                        healthPercent >= 66 ? 'bg-yellow-500 shadow-yellow-500/30' :
                        healthPercent >= 33 ? 'bg-orange-500 shadow-orange-500/30' :
                        'bg-rose-500 shadow-rose-500/30 animate-pulse';

  // Room parameters - Fully visible room number
  const roomNumberFull = profile?.room_number || '—';
  const roomNumberOnly = profile?.room_number?.split('-')[0] || '';
  const floor = calculateFloor(Number(roomNumberOnly) || 0);
  const fullName = profile?.full_name || 'Talaba';
  const faculty = profile?.faculty || 'Fakultet';
  const course = Number(profile?.course ?? 1);
  const group = profile?.group || '—';

  // Search & tab filter announcements
  const filteredElonlar = useMemo(() => {
    return elonlar.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) || 
                            e.desc.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchesTab = elonCategory === "Barchasi" || e.type === elonCategory;
      return matchesSearch && matchesTab;
    });
  }, [elonlar, searchQuery, elonCategory]);

  const surfaceBg = isLight 
    ? 'bg-white/80 border-slate-200/80 shadow-xl shadow-slate-100/40' 
    : 'bg-[#0f172a]/30 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.3)]';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';
  const textStrong = isLight ? 'text-slate-900' : 'text-white';
  const cardBorder = isLight ? 'border-slate-100' : 'border-white/5';
  const cardInnerBg = isLight ? 'bg-slate-50/70 hover:bg-slate-100/50' : 'bg-white/5 hover:bg-white/10';

  // Payment Calculations
  const totalContractFee = 3000000; // 3,000,000 UZS total contract fee
  const paidAmount = payments
    .filter(p => p.status === 'paid' || p.status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = Math.max(0, totalContractFee - paidAmount);
  const progressPercent = Math.min(100, Math.round((paidAmount / totalContractFee) * 100));
  const strokeDashoffset = Math.max(0, 213 - (213 * progressPercent) / 100);

  if (loadingProfile) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#02040a]'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 rounded-full animate-spin border-blue-500/20 border-t-blue-500" />
          <p className={`text-xs font-bold ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Tizim yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return <ProfileLoadError isLight={isLight} />;
  }

  return (
    <div className="relative w-full max-w-6xl mx-auto p-2 sm:p-4 md:p-6 space-y-6 sm:space-y-8 min-h-screen transition-colors duration-300">
      
      {/* 1. HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-white/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black uppercase tracking-[0.24em] px-2.5 py-1 rounded-full ${
              isLight ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-blue-500/10 text-cyan-400 border border-blue-500/20'
            }`}>
              {faculty}
            </span>
            <span className={`text-[9px] font-black uppercase tracking-[0.24em] px-2.5 py-1 rounded-full ${
              isLight ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {group}
            </span>
          </div>
          <Link href="/talaba/profil" className="group flex items-center gap-2">
            <h1 className={`text-2xl sm:text-4xl font-black italic tracking-tight uppercase group-hover:text-blue-500 transition-colors ${textStrong}`}>
              {fullName}
            </h1>
            <Sparkles className="size-5 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <p className={`text-xs ${textMuted}`}>Yotoqxona boshqaruv tizimidagi shaxsiy boshqaruv panelingiz.</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 ${isLight ? 'text-slate-400' : 'text-gray-600'}`} />
          <input
            type="text"
            placeholder="E'lonlarni qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full border rounded-2xl py-3.5 pl-11 pr-4 outline-none text-xs sm:text-sm transition-all ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm' 
                : 'bg-white/5 border-white/5 text-white placeholder:text-gray-500 focus:border-blue-500/30'
            }`}
          />
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        
        {/* ================= LEFT COLUMN ================= */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8">
          
          {/* Room Card & Cleaning Schedule (Tozalik Navbatchiligi) */}
          <div 
            className={`relative overflow-hidden p-6 rounded-[32px] shadow-2xl transition-all duration-300 ${
              isLight 
                ? 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white' 
                : 'bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-900 text-white border border-white/5 shadow-indigo-950/20'
            }`}
          >
            {/* Background Glow */}
            <div className="absolute right-[-10%] top-[-10%] w-[50%] h-[50%] rounded-full blur-[80px] bg-cyan-400/20" />
            
            <div className="relative z-10 space-y-5">
              {/* Header Room Info (Room number is fully displayed inside custom container with padding to avoid clip) */}
              <div className="flex justify-between items-center py-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Yotgan Joyi</span>
                  <h2 className="text-3xl sm:text-4xl font-black italic tracking-tight text-white select-none">
                    {roomNumberFull}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-xs font-black">
                  <Calendar size={14} className="text-cyan-300" />
                  <span>{floor === 0 ? '—' : `${floor}-qavat`}</span>
                </div>
              </div>
              
              {/* Replacing Room Controls with Cleaning Duty Schedule */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <p className="text-[9px] font-black tracking-widest text-white/55 uppercase">Tozalik Navbatchiligi</p>
                  
                  {/* Duty checklist status */}
                  <button 
                    onClick={handleCleaningToggle}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black transition-all uppercase ${
                      cleaningDone 
                        ? 'bg-green-500 text-white shadow-md shadow-green-500/30' 
                        : 'bg-white/15 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {cleaningDone ? <CheckCircle size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-white/40" />}
                    <span>{cleaningDone ? 'Tozalangan' : 'Bajarilmadi'}</span>
                  </button>
                </div>
                
                <div className="space-y-2 text-xs font-semibold text-white/90">
                  <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex justify-between items-center text-[10px] opacity-60 font-semibold uppercase tracking-wider">
                      <span>Bugun ({todayName})</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    </div>
                    <div className="text-sm font-black tracking-tight text-white mt-1">
                      {todayDutyPerson ? (
                        <span className={todayDutyPerson.id === profile?.id ? "text-cyan-200" : ""}>
                          {todayDutyPerson.id === profile?.id ? `${profile?.full_name} (Siz)` : todayDutyPerson.name}
                        </span>
                      ) : (
                        <span className="text-white/50 italic">Bugun hech kim biriktirilmagan — pastdagi tugma orqali tayinlang</span>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/5 text-white text-[9px] font-black uppercase tracking-wider transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                  >
                    <span>📋 Hamma navbatchilikni ko&apos;rish</span>
                  </button>
                </div>
              </div>

              {/* Floor/Course indicators */}
              <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t border-white/10">
                <div>
                  <p className="text-[9px] font-black text-white/40 mb-0.5 tracking-wider uppercase">Kurs</p>
                  <p className="text-sm font-black">{course}-kurs</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-white/40 mb-0.5 tracking-wider uppercase">Guruh</p>
                  <p className="text-sm font-black truncate">{group}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-white/40 mb-0.5 tracking-wider uppercase">Xona statusi</p>
                  <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/20 inline-block">
                    Namunali
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sardorlik Paneli Card */}
          {profile?.is_floor_captain && (
            <div className="relative overflow-hidden p-6 rounded-[32px] border border-purple-500/20 bg-purple-500/5 shadow-2xl transition-all duration-300">
              <div className="absolute right-[-10%] top-[-10%] w-[50%] h-[50%] rounded-full blur-[80px] bg-purple-500/20" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                    ⭐
                  </div>
                  <div>
                    <h4 className={`text-base font-black tracking-tight ${textStrong}`}>Sardorlik Faoliyati</h4>
                    <p className={`text-[10px] uppercase font-bold tracking-widest text-purple-400`}>
                      {profile.assigned_floor}-qavat sardori
                    </p>
                  </div>
                </div>
                <p className={`text-xs leading-relaxed ${textMuted}`}>
                  Siz ushbu qavatning sardori etib tayinlangansiz. Talabalarni ko&apos;rish va yangi e&apos;lon yuborish uchun boshqaruv paneliga o&apos;ting.
                </p>
                <Link
                  href="/sardor/dashboard"
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-purple-500/20 active:scale-98"
                >
                  Sardor paneliga o&apos;tish
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}

          {/* Floor Captain Card for normal students */}
          {floorCaptain && (
            <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg} relative overflow-hidden`}>
              <div className="absolute right-[-10%] top-[-10%] w-[40%] h-[40%] rounded-full blur-[60px] bg-cyan-500/10" />
              <div className="relative z-10">
                <h3 className={`text-[10px] font-black tracking-[0.2em] mb-4 uppercase ${
                  isLight ? 'text-blue-600' : 'text-cyan-400'
                }`}>
                  Qavat Sardori
                </h3>
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isLight ? 'bg-cyan-50 text-cyan-600' : 'bg-cyan-500/10 text-cyan-400'}`}>
                    {floorCaptain.full_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2) || 'QS'}
                  </div>
                  <div>
                    <p className={`text-sm font-black tracking-tight ${textStrong}`}>{floorCaptain.full_name}</p>
                    <p className={`text-[10px] ${textMuted} font-semibold mt-0.5`}>
                      Sizning qavatingiz ({profile?.room_number ? Math.floor((parseInt(profile.room_number.replace(/\D/g, '')) - 1) / 30) + 1 : ''}-qavat) sardori
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
                  <div className={`p-3 rounded-2xl border ${cardBorder} ${cardInnerBg} text-center`}>
                    <p className={`text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-0.5`}>Telefon</p>
                    <a href={`tel:${floorCaptain.phone_number || ''}`} className={`text-[10px] font-black ${textStrong} hover:text-cyan-400 transition-colors`}>
                      {floorCaptain.phone_number || 'Kiritilmagan'}
                    </a>
                  </div>
                  <div className={`p-3 rounded-2xl border ${cardBorder} ${cardInnerBg} text-center`}>
                    <p className={`text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-0.5`}>Email</p>
                    <p className={`text-[10px] font-black ${textStrong} truncate`}>
                      {floorCaptain.email}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Xonadoshlar Ro'yxati */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <h3 className={`text-[10px] font-black tracking-[0.2em] mb-4 uppercase ${
              isLight ? 'text-blue-600' : 'text-cyan-400'
            }`}>
              Xonadoshlar ({roommates.length} kishi)
            </h3>
            
            <div className="space-y-3">
              {roommates.map((roommate) => {
                const initials = roommate.full_name.split(' ').map(n => n[0]).join('').substring(0, 2);
                return (
                  <div 
                    key={roommate.id} 
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black border bg-blue-500/10 text-cyan-400 border-blue-500/20">
                        {initials}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${textStrong}`}>{roommate.full_name}</p>
                        <p className={`text-[9px] ${textMuted}`}>{roommate.course || 1}-kurs | {roommate.faculty || 'Talaba'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`tel:${roommate.phone_number || '+998900000000'}`} className={`p-1.5 rounded-lg border hover:bg-blue-500/10 ${isLight ? 'border-slate-200 text-slate-600' : 'border-white/5 text-gray-400'}`}>
                        <Phone size={12} />
                      </a>
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    </div>
                  </div>
                );
              })}
              {roommates.length === 0 && (
                <p className={`text-xs text-center py-4 ${textMuted}`}>Xonadoshlar ma&apos;lumoti topilmadi.</p>
              )}
            </div>
          </div>

          {/* Quick Support Contacts */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <h3 className={`text-[10px] font-black tracking-[0.2em] mb-4 uppercase ${
              isLight ? 'text-blue-600' : 'text-cyan-400'
            }`}>
              Yordam & Aloqa (Qo&apos;llab-quvvatlash)
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className={`text-xs font-bold ${textStrong}`}>Tarbiyachi (Navbatchi)</p>
                  <p className={`text-[9px] ${textMuted}`}>Mo&apos;minov Azizbek</p>
                </div>
                <a href="tel:+998909998877" className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-black ${
                  isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/5 text-gray-300 hover:bg-white/5'
                }`}>
                  <Phone size={10} /> Call
                </a>
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t border-white/5">
                <div>
                  <p className={`text-xs font-bold ${textStrong}`}>Komedant</p>
                  <p className={`text-[9px] ${textMuted}`}>Qodirov Sardor</p>
                </div>
                <a href="tel:+998931112233" className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-black ${
                  isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/5 text-gray-300 hover:bg-white/5'
                }`}>
                  <Phone size={10} /> Call
                </a>
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t border-white/5">
                <div>
                  <p className={`text-xs font-bold ${textStrong}`}>Tibbiy yordam xonasi</p>
                  <p className={`text-[9px] ${textMuted}`}>Sultonova Ra&apos;no (Shifokor)</p>
                </div>
                <a href="tel:+998944445566" className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-black ${
                  isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/5 text-gray-300 hover:bg-white/5'
                }`}>
                  <Phone size={10} /> Call
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-8">
          
          {/* Quick Actions (Tezkor Xizmatlar) */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${
              isLight ? 'text-blue-600' : 'text-indigo-400'
            }`}>
              Tezkor Xizmatlar
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <Link href="/talaba/arizalar" className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-300 group ${
                isLight ? 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white' : 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10'
              }`}>
                <FileText className={`size-6 mb-2.5 transition-transform duration-300 group-hover:scale-110 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${textStrong}`}>Ariza Yozish</span>
              </Link>
              
              <Link href="/talaba/tolova" className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-300 group ${
                isLight ? 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white' : 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10'
              }`}>
                <CreditCard className={`size-6 mb-2.5 transition-transform duration-300 group-hover:scale-110 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${textStrong}`}>To&apos;lov qilish</span>
              </Link>

              <Link href="/talaba/navbat" className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-300 group ${
                isLight ? 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white' : 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10'
              }`}>
                <Plus className={`size-6 mb-2.5 transition-transform duration-300 group-hover:scale-110 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${textStrong}`}>Navbatga turish</span>
              </Link>

              <Link href="/talaba/qoidalar" className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-300 group ${
                isLight ? 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white' : 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10'
              }`}>
                <AlertTriangle className={`size-6 mb-2.5 transition-transform duration-300 group-hover:scale-110 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${textStrong}`}>Tizim qoidalari</span>
              </Link>

              <button 
                onClick={() => setIsChatModalOpen(true)}
                className={`flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-300 group ${
                  isLight ? 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white' : 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10'
                }`}
              >
                <MessageSquare className={`size-6 mb-2.5 transition-transform duration-300 group-hover:scale-110 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-wider ${textStrong}`}>Xabarlar</span>
              </button>
            </div>
          </div>

          {/* E'lonlar Bo'limi (RE-DESIGNED NOTICE BOARD - TIMELINE CARDS) */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <div className="flex flex-col gap-3.5 mb-6">
              <div>
                <h3 className={`text-base font-black uppercase tracking-wider flex items-center gap-2 ${
                  isLight ? 'text-blue-600' : 'text-indigo-400'
                }`}>
                  <Megaphone size={18} /> E&apos;lonlar va Xabarnomalar
                </h3>
                <p className={`text-[10px] mt-1 ${textMuted}`}>Yotoqxona ma&apos;muriyati tomonidan chop etilgan so&apos;nggi yangiliklar.</p>
              </div>
              
              <div className="flex overflow-x-auto no-scrollbar gap-1.5 max-w-full pb-1 flex-nowrap shrink-0">
                {['Barchasi', 'Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'].map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setElonCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-200 shrink-0 ${
                      elonCategory === cat 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                        : isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              {filteredElonlar.map((elon) => {
                // Determine category color parameters
                const typeStyles = 
                  elon.type === 'Muhim' 
                    ? { border: 'border-l-rose-500', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', glow: 'shadow-rose-950/20' } :
                  elon.type === 'Tadbir' 
                    ? { border: 'border-l-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', glow: 'shadow-emerald-950/20' } :
                  elon.type === 'Ogohlantirish' 
                    ? { border: 'border-l-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', glow: 'shadow-amber-950/20' } :
                    { border: 'border-l-cyan-500', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', glow: 'shadow-cyan-950/20' };

                return (
                  <div 
                    key={elon.id} 
                    onClick={() => setSelectedElon(elon)}
                    className={`relative overflow-hidden rounded-2xl border-l-[6px] border border-y-transparent border-r-transparent p-5 cursor-pointer transition-all duration-200 hover:translate-x-1 group flex flex-col md:flex-row md:items-center justify-between gap-4 ${typeStyles.border} ${
                      isLight ? 'bg-white hover:bg-slate-50/50 border-slate-200 shadow-sm' : 'bg-white/5 hover:bg-white/10 border-white/5'
                    }`}
                  >
                    {/* Main content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${typeStyles.badge}`}>
                          {elon.type}
                        </span>
                        {elon.is_from_captain && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-400">
                            🌟 Qavat Sardori
                          </span>
                        )}
                        <div className={`flex items-center gap-1 text-[10px] ${textMuted}`}>
                          <Clock size={11} />
                          <span>{elon.time}</span>
                        </div>
                      </div>
                      
                      <h4 className={`text-base font-extrabold tracking-tight group-hover:text-blue-500 transition-colors ${textStrong}`}>
                        {elon.title}
                      </h4>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${textMuted}`}>{elon.desc}</p>
                    </div>

                    {/* Metadata right-side block */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-white/5 pt-3 md:pt-0 gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} />
                        <span className={`text-[10px] font-bold ${textStrong}`}>{elon.teacher}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} />
                        <span className={`text-[10px] font-bold ${textMuted}`}>{elon.room}</span>
                      </div>
                      <div className={`hidden md:flex items-center gap-0.5 text-xs font-black uppercase tracking-wider ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
                        <span>Batafsil</span>
                        <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredElonlar.length === 0 && (
                <div className={`text-center py-12 border border-dashed rounded-2xl ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                  <Megaphone className={`size-8 mx-auto mb-2 opacity-30 ${textMuted}`} />
                  <p className={`text-xs ${textMuted} italic`}>Ushbu toifaga tegishli e&apos;lonlar topilmadi.</p>
                </div>
              )}
            </div>
          </div>

          {/* Replaced Cafe Menu with Mening Murojaatlarim Statusi (My Application Statuses) */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <ClipboardList className={isLight ? 'text-blue-600' : 'text-indigo-400'} size={18} />
                <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${textStrong}`}>
                  Murojaat va Arizalarim Statusi
                </h3>
              </div>
              <Link href="/talaba/arizalar" className={`text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl border transition-all ${
                isLight ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/5 text-gray-300 hover:bg-white/5'
              }`}>
                Yangi Ariza Yozish
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {myApplications.map((app) => {
                const typeLabel = app.type === 'tushuntirish' ? 'Tushuntirish' : 'Ariza';
                const formattedDate = formatElonDate(app.createdDate);
                const statusInfo = getAppStatusInfo(app.status);
                const StatusIcon = statusInfo.icon;

                return (
                  <div key={app.id} className={`p-4 rounded-2xl border ${cardBorder} ${cardInnerBg} flex flex-col justify-between gap-3`}>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black uppercase text-indigo-400">{typeLabel}</span>
                        <span className="text-[9px] font-bold text-gray-500">{formattedDate}</span>
                      </div>
                      <h4 className={`text-xs font-bold line-clamp-2 ${textStrong}`}>
                        {app.title}
                      </h4>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg self-start border ${statusInfo.badgeClass}`}>
                      <StatusIcon size={10} />
                      <span>{statusInfo.label}</span>
                    </div>
                  </div>
                );
              })}
              {myApplications.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className={`col-span-1 sm:col-span-3 flex flex-col items-center justify-center py-10 px-6 border border-dashed rounded-3xl transition-all duration-300 relative overflow-hidden group ${
                    isLight 
                      ? 'border-slate-200 bg-white/50 hover:border-blue-400' 
                      : 'border-white/10 bg-slate-950/20 hover:border-indigo-500/40'
                  }`}
                >
                  {/* Decorative background glow */}
                  <div className="absolute -inset-10 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  {/* Floating Icon Wrapper */}
                  <motion.div 
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className={`p-4 rounded-2xl mb-4 relative ${
                      isLight ? 'bg-blue-50 text-blue-600' : 'bg-indigo-500/10 text-indigo-400'
                    }`}
                  >
                    <ClipboardList className="size-8 relative z-10" />
                    <span className="absolute inset-0 rounded-2xl bg-current opacity-10 blur-sm animate-pulse" />
                  </motion.div>

                  <h4 className={`text-sm font-black mb-1 text-center tracking-wide uppercase ${textStrong}`}>
                    Murojaatlar mavjud emas
                  </h4>
                  <p className={`text-xs text-center max-w-[280px] mb-5 leading-relaxed ${textMuted}`}>
                    Sizda hali hech qanday ariza yoki tushuntirish xati yo&apos;q. Hozir yangi ariza yuborishingiz mumkin!
                  </p>

                  <Link 
                    href="/talaba/arizalar"
                    className={`relative overflow-hidden px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 transform active:scale-95 shadow-lg ${
                      isLight 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20 hover:shadow-blue-500/30' 
                        : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-indigo-500/20 hover:shadow-indigo-500/30'
                    }`}
                  >
                    <span className="absolute inset-0 bg-white/10 translate-y-full hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative flex items-center gap-1.5">
                      <Plus size={14} className="animate-spin-slow" />
                      <span>Ariza Yozish</span>
                    </span>
                  </Link>
                </motion.div>
              )}
            </div>
          </div>

          {/* Gamified Health Card & Disciplinary Status */}
          <div className={`backdrop-blur-xl border rounded-[32px] p-6 transition-all duration-300 ${
            arizaSoni >= 3
              ? isLight ? 'bg-red-50 border-red-200 shadow-[0_0_30px_rgba(239,68,68,0.15)]' : 'bg-red-950/20 border-red-500/30'
              : surfaceBg
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-[10px] font-black tracking-[0.2em] uppercase ${
                arizaSoni >= 3 ? 'text-red-500' : isLight ? 'text-blue-600' : 'text-indigo-400'
              }`}>
                Intizom Reytingi
              </h3>

              <div className="flex items-center gap-1.5">
                <Heart size={14} className={arizaSoni >= 3 ? 'text-red-500 animate-pulse' : 'text-emerald-500'} />
                <span className={`text-[10px] font-black uppercase ${arizaSoni >= 3 ? 'text-red-500' : 'text-emerald-500'}`}>
                  Intizom darajasi: {healthPercent}%
                </span>
              </div>
            </div>

            {/* Health Bar */}
            <div className="relative w-full h-3 rounded-full bg-white/5 overflow-hidden mb-6 border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 relative overflow-hidden ${healthColor}`}
                style={{ width: `${healthPercent}%` }}
              >
                {healthPercent === 100 && (
                  <motion.div 
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-black italic ${textStrong}`}>{arizaSoni} ta faol ogohlantirish</p>
                  {arizaSoni === 0 && (
                    <motion.span 
                      animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
                      className="text-emerald-500 font-bold"
                    >
                      ✓
                    </motion.span>
                  )}
                </div>
                <p className={`text-[10px] font-bold mt-1 ${
                  arizaSoni >= 3 ? 'text-red-500 animate-pulse' : textMuted
                }`}>
                  {arizaSoni >= 3 ? "⚠️ DIQQAT: CHIQARILISH ARAFSIDA! 3 ta ogohlantirish berilgan." : "Siz intizom qoidalariga to'liq rioya etyapsiz."}
                </p>
              </div>

              <button 
                onClick={() => setShowArizalar(true)}
                className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
                  arizaSoni >= 3
                    ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                    : isLight ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-blue-500' : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <FileText size={14} />
                <span>Barcha Ogohlantirishlar ({arizaSoni})</span>
              </button>
            </div>
          </div>

          {/* Payment & Tasks (Grid inside column) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            
            {/* Payment Card */}
            <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg} flex flex-col justify-between`}>
              <div>
                <h4 className={`text-sm font-black mb-6 italic flex items-center gap-2 ${textStrong}`}>
                  <CreditCard className={isLight ? "text-blue-600" : "text-indigo-400"} /> To&apos;lov holati
                </h4>
                
                <div className="flex gap-4 items-center mb-6">
                  <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className={isLight ? "text-slate-100" : "text-white/5"} />
                      <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="213" strokeDashoffset={strokeDashoffset} className={isLight ? "text-blue-600" : "text-indigo-500"} style={{ transition: 'all 1000ms' }} />
                    </svg>
                    <div className={`absolute flex flex-col items-center ${textStrong}`}>
                      <span className="text-sm font-black italic">{progressPercent}%</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className={`text-xs font-bold ${textStrong}`}>{paidAmount.toLocaleString('uz-UZ')} UZS to&apos;landi</p>
                    <p className={`text-[10px] ${textMuted}`}>Shartnoma: {totalContractFee.toLocaleString('uz-UZ')} UZS</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className={`flex justify-between items-center p-3 rounded-xl border ${cardBorder} ${cardInnerBg}`}>
                    <span className={`text-[9px] font-black uppercase ${textMuted}`}>Qolgan to&apos;lov</span>
                    <span className={`text-xs font-black ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>{remainingAmount.toLocaleString('uz-UZ')} UZS</span>
                  </div>
                  {remainingAmount > 0 ? (
                    <div className={`flex justify-between items-center p-3 rounded-xl border animate-pulse ${
                      isLight ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/20'
                    }`}>
                      <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-red-600' : 'text-red-400'}`}>Muddati</span>
                      <span className={`text-xs font-black ${isLight ? 'text-red-600' : 'text-red-400'}`}>Kutilmoqda</span>
                    </div>
                  ) : (
                    <div className={`flex justify-between items-center p-3 rounded-xl border ${
                      isLight ? 'bg-green-50 border-green-200 text-green-700' : 'bg-green-500/10 border-green-500/20 text-green-400'
                    }`}>
                      <span className={`text-[9px] font-black uppercase tracking-wider`}>Holat</span>
                      <span className="text-xs font-black">To&apos;liq to&apos;langan ✅</span>
                    </div>
                  )}
                </div>
              </div>

              <Link 
                href="/talaba/tolova" 
                className="w-full mt-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-center text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all"
              >
                Kvitansiya Boshqaruvi
              </Link>
            </div>

            {/* To-Do List */}
            <div className={`backdrop-blur-xl border rounded-[32px] p-6 ${surfaceBg}`}>
              <h3 className={`text-[10px] font-black mb-4 uppercase tracking-widest ${
                isLight ? 'text-amber-600' : 'text-yellow-400'
              }`}>
                Shaxsiy Vazifalarim
              </h3>
              
              <div className="flex gap-2 mb-4">
                <input 
                  value={newTask} 
                  onChange={(e) => setNewTask(e.target.value)} 
                  placeholder="Yangi vazifa..." 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTask.trim()) {
                      saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), completed: false }]);
                      setNewTask("");
                    }
                  }}
                  className={`flex-1 border rounded-xl px-4 py-3 text-xs outline-none transition-all ${
                    isLight 
                      ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white' 
                      : 'bg-white/5 border-white/5 text-white placeholder:text-gray-500 focus:border-yellow-500/30'
                  }`} 
                />
                <button 
                  onClick={() => { 
                    if (newTask.trim()) { 
                      saveTasks([...tasks, { id: Date.now(), text: newTask.trim(), completed: false }]); 
                      setNewTask("") 
                    } 
                  }} 
                  className={`px-4 rounded-xl transition-all ${
                    isLight ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  }`}
                >
                  <Plus size={16} />
                </button>
              </div>
              
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {tasks.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => { 
                      saveTasks(tasks.map(task => task.id === t.id ? { ...task, completed: !task.completed } : task)) 
                    }} 
                    className={`flex items-center gap-3 p-3 border rounded-2xl cursor-pointer group transition-all duration-200 ${
                      isLight ? 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm' : 'bg-white/5 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                      t.completed 
                        ? 'bg-green-500 text-white shadow-[0_0_8px_rgba(34,197,94,0.4)]' 
                        : isLight ? 'bg-slate-50 border border-slate-300' : 'bg-white/5 border border-white/10'
                    }`}>
                      {t.completed && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    
                    <span className={`flex-1 text-xs font-semibold transition-all ${
                      t.completed 
                        ? 'line-through text-slate-400 italic' 
                        : textStrong
                    }`}>
                      {t.text}
                    </span>
                    
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        saveTasks(tasks.filter(task => task.id !== t.id)); 
                      }} 
                      className={`opacity-0 group-hover:opacity-100 p-1 transition-opacity ${
                        isLight ? 'text-slate-400 hover:text-red-600' : 'text-gray-500 hover:text-red-400'
                      }`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <p className={`text-xs text-center py-6 ${textMuted} italic`}>Hozircha vazifalar yo&apos;q.</p>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* 2. ARIZALAR RO'YXATI MODALI */}
      {mounted && typeof document !== 'undefined' && showArizalar && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowArizalar(false)}>
          <div className="bg-[#0b0f19] border border-white/5 p-4 sm:p-7 rounded-2xl sm:rounded-[40px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h4 className="text-xl font-black italic flex items-center gap-2 uppercase tracking-tighter text-indigo-400">
                <FileText /> Arizalar & Ogohlantirishlar
              </h4>
              <button onClick={() => setShowArizalar(false)} className="p-2 hover:bg-white/5 rounded-full transition-all text-gray-400 cursor-pointer"><X /></button>
            </div>
            
            <div className="space-y-3 mb-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
              {arizalar.map((ariza) => {
                const borderGlow = ariza.daraja === 'danger' ? 'border-red-500/30 hover:border-red-500' :
                                   ariza.daraja === 'warning' ? 'border-amber-500/30 hover:border-amber-500' :
                                   'border-blue-500/20 hover:border-blue-500';
                return (
                  <div
                    key={ariza.id}
                    onClick={() => setSelectedAriza(ariza)}
                    className={`p-4 rounded-2xl border bg-white/5 cursor-pointer transition-all duration-200 hover:translate-x-1 ${borderGlow}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{ariza.sana}</span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${
                        ariza.daraja === 'danger' ? 'bg-red-500/10 text-red-400' :
                        ariza.daraja === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                        {ariza.daraja}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-white line-clamp-2">{ariza.matn}</p>
                  </div>
                );
              })}
              {arizalar.length === 0 && (
                <div className="text-center py-10 flex flex-col items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                    className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 mb-4"
                  >
                    <CheckCircle2 size={32} />
                  </motion.div>
                  <p className="text-sm font-black text-white uppercase tracking-wider mb-1">
                    Ogohlantirishlar mavjud emas
                  </p>
                  <p className="text-xs text-gray-400 max-w-[280px] leading-relaxed">
                    Siz intizom qoidalariga to&apos;liq rioya etyapsiz. Rahmat! 🌟
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 3. ARIZA TO'LIQ MATNI MODALI */}
      {mounted && typeof document !== 'undefined' && selectedAriza && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-lg p-4" onClick={() => setSelectedAriza(null)}>
          <div className="bg-[#0b0f19] border border-red-500/20 p-5 sm:p-8 rounded-2xl sm:rounded-[40px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4 sm:mb-5">
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500"><AlertTriangle size={28} /></div>
            </div>
            
            <h3 className="text-center text-xl font-black italic mb-2 uppercase tracking-tight text-white">Intizomiy Ogohlantirish</h3>
            
            <div className="space-y-4 my-6 text-center">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase mb-0.5">Sana</p>
                <p className="text-xs font-bold text-white">{selectedAriza.sana}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-xl border border-white/5 italic text-xs sm:text-sm text-gray-300 leading-relaxed text-left">
                &quot;{selectedAriza.matn}&quot;
              </div>
            </div>
            
            <button 
              onClick={() => setSelectedAriza(null)} 
              className="w-full py-3.5 bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-500/30 transition-all cursor-pointer"
            >
              Yopish
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 4. E'LONLAR MODALI */}
      {mounted && typeof document !== 'undefined' && selectedElon && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4" onClick={() => setSelectedElon(null)}>
          <div className="bg-[#0b0f19] border border-white/5 p-0 rounded-2xl sm:rounded-[40px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 sm:p-8 text-white relative">
              <div className="absolute top-4 sm:top-6 right-4 sm:right-6">
                <button onClick={() => setSelectedElon(null)} className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white cursor-pointer"><X size={14} /></button>
              </div>
              <span className="text-[9px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest mb-2 sm:mb-3 inline-block">
                {selectedElon.type}
              </span>
              <h3 className="text-xl sm:text-3xl font-black italic tracking-tight leading-tight">{selectedElon.title}</h3>
            </div>
            
            <div className="p-5 sm:p-7 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <User size={14} />
                    <span className="text-[8px] font-black uppercase">Mas&apos;ul</span>
                  </div>
                  <p className="text-xs font-bold text-white">{selectedElon.teacher}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1">
                    <MapPin size={14} />
                    <span className="text-[8px] font-black uppercase">Joy</span>
                  </div>
                  <p className="text-xs font-bold text-white">{selectedElon.room}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Batafsil ma&apos;lumot</p>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5 italic">
                  &quot;{selectedElon.desc}&quot;
                </p>
              </div>
              
              <button 
                onClick={() => setSelectedElon(null)} 
                className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all text-white cursor-pointer"
              >
                Tushunarli
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 5. FLOATING AI ASSISTANT BUTTON & CHAT DRAWER */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed bottom-24 sm:bottom-28 right-6 z-[9999] pointer-events-auto">
            <button
              onClick={() => setIsChatOpen(true)}
              className={`flex items-center justify-center p-4 rounded-full border shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 group ${
                isLight
                  ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-blue-500/20'
                  : 'bg-gradient-to-r from-cyan-500 to-indigo-600 border-cyan-400/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]'
              }`}
            >
              <Sparkles className="size-6 animate-pulse" />
            </button>
          </div>

          {/* 6. AI CHAT SIDEBAR/DRAWER */}
          {isChatOpen && (
            <div className="fixed inset-0 z-[10000] flex justify-end bg-black/60 backdrop-blur-xs">
              {/* Backdrop Click */}
              <div className="absolute inset-0 pointer-events-auto" onClick={() => setIsChatOpen(false)} />
              
              <div className={`relative w-full max-w-md h-full shadow-2xl border-l flex flex-col justify-between backdrop-blur-2xl transition-all duration-300 pointer-events-auto ${
                isLight
                  ? 'bg-white/95 border-slate-200 text-slate-900'
                  : 'bg-[#0b101d]/95 border-white/5 text-white'
              }`}>
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles size={20} className={isLight ? 'text-blue-600' : 'text-cyan-400'} />
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-wider ${textStrong}`}>🤖 Yotoqxona AI</h3>
                      <p className={`text-[10px] ${textMuted}`}>Savollarga real vaqtda javob beradi</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className={`p-2 rounded-xl transition-all border ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 pr-3 custom-scrollbar text-xs sm:text-sm">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] p-3.5 rounded-2xl border ${
                        msg.role === 'user'
                          ? isLight
                            ? 'bg-blue-600 border-blue-500 text-white rounded-br-none shadow-md shadow-blue-500/10'
                            : 'bg-indigo-600 border-indigo-500 text-white rounded-br-none shadow-md shadow-indigo-600/10'
                          : isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-900 rounded-bl-none'
                            : 'bg-white/5 border-white/5 text-white rounded-bl-none'
                      }`}>
                        {msg.role === 'model' ? (
                          <ChatMarkdownMessage text={msg.text} />
                        ) : (
                          msg.text
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className={`p-3.5 rounded-2xl border rounded-bl-none flex items-center gap-2 ${
                        isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-white/5 border-white/5 text-white'
                      }`}>
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce delay-75" />
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce delay-150" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Chips & Input Footer */}
                <div className="p-4 border-t border-white/5 space-y-3.5 shrink-0 bg-white/[0.01]">
                  {/* Quick Reply Chips */}
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {[
                      '🚪 Kirish-chiqish vaqti',
                      '💳 To\'lov narxi',
                      '🧹 Navbatchiligim qachon?',
                      '📞 Komendant raqami'
                    ].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handleSendMessage(chip)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                          isLight
                            ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                            : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/15'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Savolingizni kiriting..."
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendMessage()
                      }}
                      className={`flex-1 border rounded-xl px-4 py-3 text-xs outline-none transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white'
                          : 'bg-white/5 border-white/5 text-white focus:border-indigo-500/30'
                      }`}
                    />
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={chatLoading || !userMessage.trim()}
                      className={`px-4 rounded-xl transition-all flex items-center justify-center ${
                        isLight
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                      }`}
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}

      {/* 3. CLEANING SCHEDULE MODAL */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isScheduleModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              {/* Backdrop with Blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsScheduleModalOpen(false)}
                className="absolute inset-0 bg-[#02040a]/60 backdrop-blur-md"
              />

              {/* 3D Premium Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, rotateX: -8, y: 20 }}
                animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, rotateX: 8, y: -20 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
                className={`relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl sm:rounded-[32px] border shadow-[0_0_50px_rgba(30,58,138,0.4)] ${
                  isLight
                    ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-200/50'
                    : 'bg-[#0f172a]/90 border-white/10 text-white shadow-indigo-950/50'
                }`}
              >
                {/* Premium Background Glows */}
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full blur-[100px] bg-blue-600/10 pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full blur-[100px] bg-purple-600/10 pointer-events-none" />

                {/* Modal Header */}
                <div className={`relative z-10 shrink-0 flex justify-between items-center gap-3 border-b px-4 sm:px-8 pt-4 sm:pt-8 pb-4 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight flex items-center gap-2">
                      🧹 Tozalik Navbatchiligi
                    </h2>
                    <p className={`text-xs mt-1 truncate ${textMuted}`}>
                      Xona {profile?.room_number || '—'} uchun hafta kunlariga navbatchilarni biriktiring.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsScheduleModalOpen(false)}
                    className={`shrink-0 p-2 rounded-full border transition-all cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 sm:px-8 py-4 sm:py-6 space-y-8">
                  {/* Top Section: Weekdays List */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-blue-500 mb-4">
                      📅 Hafta Kunlari (Navbatchilik Slotlari)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                      {WEEKDAYS.map((day) => {
                        const assigned = draftSchedule[day];
                        const isDragOver = activeDragOverDay === day;
                        return (
                          <div
                            key={day}
                            onClick={() => handleDayClick(day)}
                            onDragOver={(e) => handleDragOver(e)}
                            onDragEnter={(e) => handleDragEnter(e, day)}
                            onDragLeave={(e) => handleDragLeave(e, day)}
                            onDrop={(e) => handleDrop(e, day)}
                            className={`group relative min-w-0 flex flex-col justify-between p-3.5 min-h-[105px] rounded-2xl border transition-all duration-300 cursor-pointer select-none ${
                              isDragOver
                                ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(34,211,238,0.25)] scale-[1.02]'
                                : assigned
                                  ? isLight
                                    ? 'border-blue-200 bg-blue-50/70 hover:border-blue-300'
                                    : 'border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50'
                                  : isLight
                                    ? 'border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-100/50 hover:border-slate-400'
                                    : 'border-dashed border-white/10 bg-slate-950/20 hover:bg-white/5 hover:border-white/20'
                            }`}
                          >
                            <span className={`text-[10px] font-black uppercase tracking-wider mb-2 truncate ${
                              assigned
                                ? isLight ? 'text-blue-600' : 'text-cyan-400'
                                : textMuted
                            }`}>
                              {day}
                            </span>

                            <div className="flex-grow flex items-end min-w-0" onClick={(e) => e.stopPropagation()}>
                              <CustomSelect
                                value={assigned ? assigned.id : ''}
                                onChange={(val) => {
                                  if (val) {
                                    const resident = allResidents.find(r => r.id === val);
                                    if (resident) {
                                      setDraftSchedule(prev => ({
                                        ...prev,
                                        [day]: { id: resident.id, name: resident.name }
                                      }));
                                    }
                                  } else {
                                    setDraftSchedule(prev => {
                                      const next = { ...prev };
                                      delete next[day];
                                      return next;
                                    });
                                  }
                                }}
                                placeholder="— Bo'sh —"
                                options={[
                                  { value: '', label: "— Bo'sh —" },
                                  ...allResidents.map((r) => ({ value: r.id, label: r.name.replace(" (Siz)", "") })),
                                ]}
                                className={`min-w-0 text-xs font-bold py-1.5 px-2 rounded-xl border focus:outline-hidden transition-all cursor-pointer ${
                                  isLight
                                    ? 'bg-white border-slate-200 text-slate-800 focus:border-blue-400 shadow-xs'
                                    : 'bg-slate-900 border-white/5 text-white focus:border-cyan-400 shadow-md shadow-black/20'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom Section: Roommates (Draggable Cards) */}
                  <div>
                    <div className="flex justify-between items-center gap-2 mb-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500 truncate">
                        👥 Xonadoshlar (Ushlab torting yoki Tanlang)
                      </h3>
                      <span className={`shrink-0 text-[10px] font-semibold ${textMuted}`}>
                        {selectedResidentId ? "💡 Kunni bosing" : "💡 Torting yoki bosing"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {allResidents.map((resident) => {
                        const isSelected = selectedResidentId === resident.id;
                        const isSelf = resident.isSelf;
                        return (
                          <div
                            key={resident.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, resident.id)}
                            onClick={() => handleResidentClick(resident.id)}
                            className={`group relative min-w-0 flex flex-col justify-between p-4 rounded-2xl cursor-grab active:cursor-grabbing select-none transition-all duration-300 transform preserve-3d ${
                              isSelected
                                ? 'border-2 border-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.25)] scale-[1.03] -translate-y-1'
                                : isLight
                                  ? 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
                                  : 'bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 hover:-translate-y-0.5 shadow-lg'
                            }`}
                            style={{
                              boxShadow: isSelected
                                ? '0 10px 20px rgba(234,179,8,0.15)'
                                : isLight
                                  ? '0 4px 6px rgba(0,0,0,0.02), 0 10px 15px -3px rgba(0,0,0,0.03)'
                                  : '0 4px 6px rgba(0,0,0,0.1), 0 10px 15px -3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
                            }}
                          >
                            {/* Draggable Icon indicator */}
                            <div className="flex justify-between items-center mb-3">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                isSelf
                                  ? 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20'
                                  : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-slate-400'
                              }`}>
                                {isSelf ? "Siz" : "Xonadosh"}
                              </span>
                              <div className={`flex flex-col gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity`}>
                                <span className="w-2.5 h-0.5 bg-current rounded-full" />
                                <span className="w-2.5 h-0.5 bg-current rounded-full" />
                                <span className="w-2.5 h-0.5 bg-current rounded-full" />
                              </div>
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-black tracking-tight leading-tight mb-1 truncate">
                                {resident.name.replace(" (Siz)", "")}
                              </p>
                              <p className={`text-[10px] ${textMuted} font-semibold truncate`}>
                                Tanlang yoki torting
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Modal Footer / Actions */}
                <div className={`relative z-10 shrink-0 flex flex-wrap justify-between items-center border-t px-4 sm:px-8 pb-4 sm:pb-8 pt-4 gap-3 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                  <button
                    onClick={handleResetDraft}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                        : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:bg-white/10'
                    }`}
                  >
                    🔄 Asliga Qaytarish
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsScheduleModalOpen(false)}
                      className={`px-5 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                        isLight
                          ? 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          : 'bg-white/0 border-white/5 text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      Bekor Qilish
                    </button>
                    <button
                      onClick={handleSaveSchedule}
                      disabled={isSavingSchedule}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg active:scale-95 transition-all duration-300 disabled:opacity-50 cursor-pointer ${
                        isLight
                          ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                          : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                      }`}
                    >
                      {isSavingSchedule ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Saqlanmoqda...
                        </>
                      ) : (
                        "Saqlash"
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Student Chat Modal */}
      {mounted && isChatModalOpen && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsChatModalOpen(false)}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative flex flex-col w-full max-w-lg h-[500px] overflow-hidden rounded-3xl border shadow-2xl ${
                isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0f172a] border-white/10 text-white'
              }`}
            >
              {/* Modal Header */}
              <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
                isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-[#1e293b]/50'
              }`}>
                <div>
                  <h3 className="text-sm font-bold leading-none">Admin bilan yozishuv</h3>
                  <p className="text-[10px] text-slate-400 mt-1">Shaxsiy xabarlar va javoblar</p>
                </div>
                <button
                  onClick={() => setIsChatModalOpen(false)}
                  className={`p-1.5 rounded-lg border transition-all ${
                    isLight 
                      ? 'border-slate-200 hover:bg-slate-100 text-slate-500' 
                      : 'border-white/10 hover:bg-white/5 text-slate-400'
                  }`}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Chat bubbles container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar flex flex-col min-h-0">
                {loadingAdminChat ? (
                  <p className="text-center text-xs text-slate-500 my-auto">Yuklanmoqda...</p>
                ) : adminChatMessages.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 my-auto">Xabarlar mavjud emas. Adminga xabar yuborishingiz mumkin.</p>
                ) : (
                  adminChatMessages.map((msg) => {
                    const isStudentSender = msg.title === 'talaba'
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[80%] rounded-2xl p-3 text-xs ${
                          isStudentSender
                            ? 'self-end bg-purple-600 text-white rounded-br-none'
                            : isLight
                              ? 'self-start bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                              : 'self-start bg-slate-800 text-slate-100 rounded-bl-none border border-white/5'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words font-medium">{msg.reason}</p>
                        <span className={`text-[8px] self-end mt-1 font-bold ${
                          isStudentSender ? 'text-purple-200' : 'text-slate-400'
                        }`}>
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Composer form */}
              <form onSubmit={handleSendChatMessage} className={`p-4 border-t flex gap-2 shrink-0 ${
                isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-[#1e293b]/30'
              }`}>
                <input
                  type="text"
                  placeholder="Xabar yozing..."
                  value={adminChatInput}
                  onChange={(e) => setAdminChatInput(e.target.value)}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-xs outline-none transition-all ${
                    isLight
                      ? 'bg-white border border-slate-200 text-slate-900 focus:border-purple-500'
                      : 'bg-slate-900 border border-white/10 text-white focus:border-purple-500/50'
                  }`}
                  disabled={sendingAdminChat}
                />
                <button
                  type="submit"
                  disabled={sendingAdminChat || !adminChatInput.trim()}
                  className="px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {sendingAdminChat ? '...' : 'Yuborish'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
}


// ─── Helper Functions ──────────────────────────────────────────────────────

function calculateFloor(roomNumber: number): number {
  if (roomNumber === 0 || isNaN(roomNumber)) return 0;
  if (roomNumber < 100) return 1;
  if (roomNumber < 200) return 2;
  if (roomNumber < 300) return 3;
  if (roomNumber < 400) return 4;
  return 5;
}
