"use client";

import React, { useState } from 'react';
import { 
  Search, Clock, X, 
  Plus, CreditCard, Trash2, CheckCircle2, UserPlus, UserMinus,
  Megaphone, Calendar, MapPin, User, FileText, AlertTriangle
} from 'lucide-react';

export default function TalabaDashboard() {
  const [showArizalar, setShowArizalar] = useState(false);
  const [selectedElon, setSelectedElon] = useState<any>(null);
  const [selectedAriza, setSelectedAriza] = useState<any>(null);
  
  const [tasks, setTasks] = useState([
    { id: 1, text: "Matematik analiz topshirig'ini yuklash", completed: true },
    { id: 2, text: "3-qavat majlisiga borish", completed: false }
  ]);
  const [newTask, setNewTask] = useState("");

  const [arizalar, setArizalar] = useState([
    { 
      id: 1, 
      ism: "Sherzod G'apparov", 
      kurs: "1-kurs", 
      yonalish: "Amaliy Matematika", 
      sana: "10.03.2026",
      matn: "Yotoqxona ichki tartib qoidalarini buzganlik (kech qolish) bo'yicha tushuntirish xati.",
      daraja: "warning"
    },
    { 
      id: 2, 
      ism: "Sherzod G'apparov", 
      kurs: "1-kurs", 
      yonalish: "Amaliy Matematika", 
      sana: "15.03.2026",
      matn: "Xona tozaligi talablariga rioya qilmaganlik uchun rasmiy ogohlantirish.",
      daraja: "warning"
    }
  ]);

  const arizaSoni = arizalar.length;
  const haydalishArafasida = arizaSoni >= 3;

  return (
    <div className="relative w-full max-w-[1100px] mx-auto p-4 md:p-8 space-y-8 bg-[#050810] min-h-screen text-white font-sans">
      
      {/* 1. HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Amaliy Matematika & IT</p>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase">Sherzod G'apparov</h1>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
          <input type="text" placeholder="Qidirish..." className="w-full bg-[#0f172a]/60 border border-white/5 rounded-2xl py-3 pl-10 pr-4 outline-none text-sm" />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-8">
          {/* ROOM CARD */}
          <div className="bg-gradient-to-br from-indigo-600 via-blue-700 to-indigo-900 p-8 rounded-[45px] shadow-2xl hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-baseline gap-2 mb-8">
              <h2 className="text-6xl font-black italic text-white tracking-tighter">#87</h2>
              <span className="text-sm font-black uppercase tracking-[0.2em] text-white/40 italic">XONA</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-6 border-t border-white/20">
              <StatMini l="QAVAT" v="3" />
              <StatMini l="KURS" v="1" />
              <StatMini l="GURUH" v="TMI-03" />
              <StatMini l="HOLAT" v="Aktiv" active />
            </div>
          </div>

          {/* XONADOSHLAR */}
          <div className="bg-[#0f172a]/40 border border-white/5 rounded-[32px] p-6 hover:scale-[1.01] transition-all">
            <h3 className="text-[10px] font-black text-green-400 tracking-[0.2em] mb-6 uppercase">Xonadoshlar (4 kishi)</h3>
            <div className="space-y-3">
              <Xonadosh name="Sherzod G'apparov" kurs="1-kurs" img="SG" me />
              <Xonadosh name="Dilshod Latipov" kurs="1-kurs" img="DL" />
              <Xonadosh name="Gaxriman Araznepesov" kurs="1-kurs" img="GA" />
              <Xonadosh name="Melisbek Kulishev" kurs="1-kurs" img="MK" />
            </div>
          </div>

          {/* TALABA ARIZALARI */}
          <div className={`border rounded-[32px] p-6 transition-all duration-500 ${haydalishArafasida ? 'bg-red-500/20 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'bg-[#0f172a]/40 border-white/5'}`}>
            <h3 className={`text-[10px] font-black tracking-[0.2em] mb-4 uppercase ${haydalishArafasida ? 'text-red-400' : 'text-indigo-400'}`}>
              Tartib-intizom holati
            </h3>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-2xl font-black italic">{arizaSoni} ta ariza</p>
                <p className="text-[10px] text-gray-500 font-bold">{haydalishArafasida ? "CHIQARILISH ARAFSIDA!" : "Hozircha xavfsiz"}</p>
              </div>
              <div className={`p-3 rounded-2xl ${haydalishArafasida ? 'bg-red-500 text-white' : 'bg-white/5 text-indigo-400'}`}>
                <AlertTriangle size={24} />
              </div>
            </div>
            <ServiceBtn 
              icon={<FileText className={haydalishArafasida ? "text-red-400" : "text-blue-400"} />} 
              label="Arizalarni ko'rish" 
              onClick={() => setShowArizalar(true)} 
            />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-8">
          {/* E'LONLAR */}
          <div className="bg-[#0f172a]/40 border border-white/5 rounded-[32px] p-7 hover:scale-[1.01] transition-all">
            <h3 className="text-[10px] font-black text-indigo-400 mb-6 uppercase tracking-widest flex items-center gap-2">
              <Megaphone size={14} /> So'nggi e'lonlar
            </h3>
            <div className="space-y-4">
              <ElonCard 
                title="Fakultet Bayram Tadbiri" 
                time="Ertaga" 
                desc="Navro'z sayli va talabalar bayrami bo'lib o'tadi."
                onClick={() => setSelectedElon({
                  title: "Navro'z va Fakultet bayrami",
                  type: "TADBIR",
                  teacher: "Ma'naviyat bo'limi",
                  room: "Fakultet hovlisi",
                  time: "Ertaga, 10:00",
                  desc: "Milliy taomlar sayli, sport musobaqalari va bayram konserti barchangizni kutmoqda!"
                })}
              />
              <ElonCard 
                title="Frontend darslari" 
                time="Bugun" 
                desc="React bo'yicha amaliy darslar."
                onClick={() => setSelectedElon({
                  title: "Frontend darslari",
                  type: "DARSLAR",
                  teacher: "Mo'minov Azizbek ",
                  room: "302-xona",
                  time: "Bugun, 20:00",
                  desc: "React.js kutubxonasi bo'yicha amaliy darslar davom etadi."
                })}
              />
            </div>
          </div>

          {/* TO-DO LIST */}
          <div className="bg-[#0f172a]/40 border border-white/5 rounded-[32px] p-7 hover:scale-[1.01] transition-all">
            <h3 className="text-[10px] font-black text-yellow-400 mb-6 uppercase tracking-widest">To-Do List</h3>
            <div className="flex gap-2 mb-6">
              <input value={newTask} onChange={(e)=>setNewTask(e.target.value)} placeholder="Yangi vazifa..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-yellow-500/30 transition-all" />
              <button onClick={()=>{if(newTask){setTasks([...tasks, {id:Date.now(), text:newTask, completed:false}]); setNewTask("")}}} className="px-4 bg-yellow-500/20 text-yellow-400 rounded-xl hover:bg-yellow-500/30 transition-all"><Plus size={20}/></button>
            </div>
            <div className="space-y-3">
              {tasks.map(t => (
                <div key={t.id} onClick={()=>{setTasks(tasks.map(task=>task.id===t.id?{...task, completed:!task.completed}:task))}} className="flex items-center gap-4 p-4 bg-[#161f31]/60 border border-white/5 rounded-2xl cursor-pointer group transition-all hover:bg-[#1e293b]">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${t.completed ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-white/5 border border-white/10'}`}>
                    {t.completed && <CheckCircle2 size={16} className="text-white" />}
                  </div>
                  <span className={`flex-1 text-sm font-medium ${t.completed ? "line-through text-gray-500 italic" : "text-gray-200"}`}>{t.text}</span>
                  <button onClick={(e) => {e.stopPropagation(); setTasks(tasks.filter(task => task.id !== t.id))}} className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* TO'LOV HOLATI (JOYIGA QAYTARILDI) */}
          <div className="bg-[#0f172a]/40 border border-white/5 rounded-[32px] p-8 hover:scale-[1.01] transition-all">
             <h4 className="text-xl font-black mb-6 italic flex items-center gap-2">
               <CreditCard className="text-indigo-400" /> To'lov Holati
             </h4>
             <div className="flex flex-col md:flex-row gap-8 items-center mb-8">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-white/5" />
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray="364" strokeDashoffset="54" className="text-indigo-500 transition-all duration-1000" />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-xl font-black italic">85%</span>
                    <span className="text-[8px] uppercase font-bold text-gray-500">To'langan</span>
                  </div>
                </div>
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black text-gray-500 uppercase">To'langan miqdor</span>
                    <span className="text-sm font-black text-green-400">350,000 UZS</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black text-gray-500 uppercase">Oxirgi sana</span>
                    <span className="text-sm font-black text-white italic">12.03.2026</span>
                  </div>
                  <div className="flex justify-between items-center bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Qolgan vaqt</span>
                    <span className="text-sm font-black text-red-400 animate-pulse">8 kun ichida</span>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* ARIZALAR RO'YXATI MODALI */}
      {showArizalar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowArizalar(false)}>
          <div className="bg-[#0f172a] border border-white/10 p-7 rounded-[40px] shadow-2xl w-full max-w-[450px]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 text-white">
              <h4 className="text-xl font-black italic flex items-center gap-2 uppercase tracking-tighter text-indigo-400">
                <FileText /> Arizalar va Ogohlantirishlar
              </h4>
              <button onClick={() => setShowArizalar(false)} className="p-2 hover:bg-white/5 rounded-full transition-all"><X /></button>
            </div>
            <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {arizalar.map((ariza) => (
                <div 
                  key={ariza.id} 
                  onClick={() => setSelectedAriza(ariza)}
                  className="p-4 rounded-2xl border bg-white/5 border-white/5 hover:border-indigo-500/50 cursor-pointer transition-all hover:translate-x-1"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{ariza.sana}</span>
                    <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                  </div>
                  <p className="text-sm font-bold text-white mb-1">{ariza.ism}</p>
                  <p className="text-[10px] text-gray-500 uppercase font-black">{ariza.kurs} | {ariza.yonalish}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ARIZA TO'LIQ MATNI MODALI */}
      {selectedAriza && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-lg p-4" onClick={() => setSelectedAriza(null)}>
          <div className="bg-[#0f172a] border border-red-500/30 p-8 rounded-[45px] shadow-2xl w-full max-w-[400px]" onClick={e => e.stopPropagation()}>
             <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500"><AlertTriangle size={32} /></div>
             </div>
             <h3 className="text-center text-2xl font-black italic mb-2 uppercase tracking-tighter">Ariza Tafsiloti</h3>
             <div className="space-y-4 my-8">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                   <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Talaba</p>
                   <p className="text-sm font-bold text-white">{selectedAriza.ism}</p>
                   <p className="text-[10px] text-indigo-400 font-bold">{selectedAriza.yonalish}</p>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 italic text-sm text-gray-300 leading-relaxed">
                   "{selectedAriza.matn}"
                </div>
             </div>
             <button onClick={() => setSelectedAriza(null)} className="w-full py-4 bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500/30 transition-all">Yopish</button>
          </div>
        </div>
      )}

      {/* E'LONLAR MODALI */}
      {selectedElon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setSelectedElon(null)}>
          <div className="bg-[#0f172a] border border-white/10 p-0 rounded-[45px] shadow-2xl w-full max-w-[450px] overflow-hidden animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-indigo-600 p-8 text-white relative">
              <div className="absolute top-6 right-6">
                <button onClick={() => setSelectedElon(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"><X size={20} /></button>
              </div>
              <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest mb-4 inline-block">{selectedElon.type}</span>
              <h3 className="text-3xl font-black italic tracking-tighter leading-tight">{selectedElon.title}</h3>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1"><User size={14} /><span className="text-[9px] font-black uppercase">Mas'ul</span></div>
                  <p className="text-xs font-bold text-white">{selectedElon.teacher}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-2 text-indigo-400 mb-1"><MapPin size={14} /><span className="text-[9px] font-black uppercase">Joy</span></div>
                  <p className="text-xs font-bold text-white">{selectedElon.room}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Batafsil ma'lumot</p>
                <p className="text-sm text-gray-300 leading-relaxed italic">"{selectedElon.desc}"</p>
              </div>
              <button onClick={() => setSelectedElon(null)} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all">Tushunarli</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function StatMini({ l, v, active = false }: any) {
  return (
    <div className="text-center">
      <p className="text-[14px] font-black text-white/40 mb-1 tracking-widest">{l}</p>
      <p className={`text-xl font-black ${active ? 'text-green-300' : 'text-white'}`}>{v}</p>
    </div>
  );
}

function Xonadosh({ name, kurs, img, me = false }: any) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${me ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-white/5 border-transparent'}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 text-[10px] font-bold border border-white/5">{img}</div>
        <div><p className="text-xs font-bold text-white">{name}</p><p className="text-[9px] text-gray-500">{kurs}</p></div>
      </div>
      <div className={`w-1.5 h-1.5 rounded-full ${me ? 'bg-indigo-400 animate-pulse' : 'bg-green-500'}`}></div>
    </div>
  );
}

function ServiceBtn({ icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className="w-full flex flex-col items-center p-5 bg-white/5 rounded-[24px] border border-white/5 hover:border-indigo-500/30 transition-all hover:scale-[1.02]">
      <div className="mb-2">{icon}</div>
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
    </button>
  );
}

function ElonCard({ title, time, desc, onClick }: any) {
  return (
    <button onClick={onClick} className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all hover:translate-x-1 group">
      <div className="flex justify-between mb-1">
        <p className="text-xs font-black text-white uppercase italic group-hover:text-indigo-400 transition-colors">{title}</p>
        <span className="text-[9px] text-gray-500 font-bold uppercase">{time}</span>
      </div>
      <p className="text-[10px] text-gray-400 line-clamp-1">{desc}</p>
    </button>
  );
}