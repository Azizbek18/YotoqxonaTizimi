"use client";

import { useState } from "react";
import Link from "next/link";
import React from "react";

// ─── Turlar ───────────────────────────────────────────────────────────────────
interface QoidaItem {
  id: string;
  sarlavha: string;
  emoji: string;
  soni: string;
  color: string;
  bandlar: string[];
}

interface NavItemProps {
  href: string;
  label: string;
  icon: string;
  isActive?: boolean;
}

// ─── Ma'lumotlar ──────────────────────────────────────────────────────────────
const qoidalarData: QoidaItem[] = [
  {
    id: "yashash",
    sarlavha: "Yashash tartibi",
    emoji: "🏠",
    soni: "4 ta qoida",
    color: "#3b82f6",
    bandlar: [
      "Kirish-chiqish vaqti: 06:00 dan 23:00 gacha.",
      "Xonalarni har kuni soat 09:00 gacha tozalash shart.",
      "Begona shaxslarni olib kirish taqiqlanadi.",
      "Haftalik umumiy tozalik ishlarida qatnashish majburiy.",
    ],
  },
  {
    id: "intizom",
    sarlavha: "Intizom",
    emoji: "🔇",
    soni: "3 ta qoida",
    color: "#8b5cf6",
    bandlar: [
      "Sukunat vaqti: 22:00 dan 07:00 gacha.",
      "Alkogol va tamaki mahsulotlari qat'iyan man etiladi.",
      "Jamoat joylarida baland ovozda gaplashish taqiqlanadi.",
    ],
  },
  {
    id: "kommunal",
    sarlavha: "Kommunal xizmatlar",
    emoji: "⚡",
    soni: "3 ta qoida",
    color: "#f59e0b",
    bandlar: [
      "Elektr energiyasini tejash va chiroqni o'chirib yurish.",
      "Suvdan oqilona foydalanish shart.",
      "Nosozliklar haqida darhol ma'muriyatga xabar bering.",
    ],
  },
  {
    id: "admin",
    sarlavha: "Ma'muriy qoidalar",
    emoji: "📋",
    soni: "2 ta qoida",
    color: "#10b981",
    bandlar: [
      "Hujjatlarni topshirish muddati: har semestr boshida.",
      "Xonani almashtirish uchun ariza 5 kun oldin beriladi.",
    ],
  },
  {
    id: "jazo",
    sarlavha: "Jazo choralari",
    emoji: "🛡️",
    soni: "3 ta qoida",
    color: "#ef4444",
    bandlar: [
      "Birinchi qoidabuzarlik: rasmiy ogohlantirish.",
      "Ikkinchi qoidabuzarlik: reytingdan 30 ball chegirish.",
      "Takroriy holatda: yotoqxonadan chetlatish.",
    ],
  },
  {
    id: "favqulodda",
    sarlavha: "Favqulodda holat",
    emoji: "📞",
    soni: "2 ta qoida",
    color: "#f97316",
    bandlar: [
      "Yong'in xavfsizligi xizmati: 101",
      "Tez yordam va navbatchi: +998 71 200 00 00",
    ],
  },
];

// ─── Nav tugmasi ──────────────────────────────────────────────────────────────
function NavItem({ href, label, icon, isActive = false }: NavItemProps) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textDecoration: "none",
        color: isActive ? "#3b82f6" : "#9ca3af",
        fontSize: "10px",
        gap: "4px",
        transition: "color 0.2s ease",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon} />
      </svg>
      <span>{label}</span>
      {isActive && (
        <div
          style={{
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            backgroundColor: "#3b82f6",
            marginTop: "2px",
          }}
        />
      )}
    </Link>
  );
}

// ─── Asosiy komponent ─────────────────────────────────────────────────────────
export default function QoidalarPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleAccordion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0f1e",
        color: "#ffffff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "40px 20px 120px 20px",
        backgroundImage:
          "radial-gradient(circle at 2px 2px, rgba(59, 130, 246, 0.05) 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }}
    >
      <style>{`
        @keyframes shimmer {
          to { background-position: 200% center; }
        }
        @keyframes pulseBorder {
          0% { border-left-color: #ef4444; }
          50% { border-left-color: rgba(239, 68, 68, 0.3); }
          100% { border-left-color: #ef4444; }
        }
        .card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(59, 130, 246, 0.15) !important;
          background-color: rgba(255, 255, 255, 0.05) !important;
        }
        @media (min-width: 1025px) {
          .mobile-nav { display: none !important; }
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: "720px", margin: "0 auto" }}>

        {/* SARLAVHA */}
        <h1
          style={{
            fontSize: "clamp(36px, 8vw, 48px)",
            fontWeight: 800,
            textAlign: "center",
            marginBottom: "12px",
            background: "linear-gradient(to right, #3b82f6, #8b5cf6, #3b82f6)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: "shimmer 3s linear infinite",
          }}
        >
          QOIDALAR
        </h1>

        <p style={{ textAlign: "center", color: "#6b7280", fontSize: "13px", marginBottom: "24px" }}>
          Yotoqxona ichki tartibi
        </p>

        {/* OGOHLANTIRISH */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            borderRadius: "12px",
            borderLeft: "4px solid #ef4444",
            marginBottom: "32px",
            fontSize: "13px",
            color: "#f87171",
            fontWeight: 700,
            animation: "pulseBorder 2s infinite",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: "12px", flexShrink: 0 }}
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Qoidalarni buzish talaba reytingiga va yashash huquqiga ta&apos;sir qiladi!
        </div>

        {/* QOIDALAR RO'YXATI */}
        {qoidalarData.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className="card-hover"
              onClick={() => toggleAccordion(item.id)}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderRadius: "16px",
                marginBottom: "12px",
                border: `1px solid ${isOpen ? item.color + "55" : "rgba(255, 255, 255, 0.08)"}`,
                borderLeft: `4px solid ${item.color}`,
                boxShadow: isOpen
                  ? `0 8px 32px ${item.color}22`
                  : "0 4px 24px rgba(0,0,0,0.3)",
                transition: "all 0.3s ease",
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              {/* Kartochka header */}
              <div
                style={{
                  padding: "18px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      fontSize: "22px",
                      width: "44px",
                      height: "44px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: `${item.color}18`,
                      borderRadius: "12px",
                      flexShrink: 0,
                    }}
                  >
                    {item.emoji}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "15px" }}>
                      {item.sarlavha}
                    </p>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: "4px",
                        fontSize: "11px",
                        color: item.color,
                        backgroundColor: `${item.color}18`,
                        padding: "2px 10px",
                        borderRadius: "20px",
                      }}
                    >
                      {item.soni}
                    </span>
                  </div>
                </div>

                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    flexShrink: 0,
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.3s ease",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Accordion body */}
              <div
                style={{
                  maxHeight: isOpen ? "500px" : "0",
                  opacity: isOpen ? 1 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.35s ease, opacity 0.25s ease",
                }}
              >
                <div
                  style={{
                    padding: "12px 20px 18px 78px",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {item.bandlar.map((band, index) => (
                      <li
                        key={index}
                        style={{
                          fontSize: "13px",
                          lineHeight: "1.7",
                          color: "#9ca3af",
                          display: "flex",
                          gap: "10px",
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor: item.color,
                            flexShrink: 0,
                            marginTop: "7px",
                          }}
                        />
                        {band}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PASTKI NAVIGATSIYA - faqat mobil */}
      <nav
        className="mobile-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "70px",
          backgroundColor: "rgba(10, 15, 30, 0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "0 10px",
          zIndex: 1000,
        }}
      >
        <NavItem href="/talaba/dashboard" label="Asosiy" icon="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
        <NavItem href="/talaba/elonlar" label="E'lonlar" icon="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0" />
        <NavItem href="/talaba/navbat" label="Navbat" icon="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2" />
        <NavItem href="/talaba/qoidalar" label="Qoidalar" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" isActive />
        <NavItem href="/talaba/profil" label="Profil" icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      </nav>
    </div>
  );
}