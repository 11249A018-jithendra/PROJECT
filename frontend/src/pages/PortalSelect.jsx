import {
  ShieldCheck,
  UserCog,
  GraduationCap,
  ScanLine,
  ArrowRight,
  Clock,
  Building2,
  Users2,
  Building
} from 'lucide-react';

const ROLES = [
  {
    to: '/staff/login',
    title: 'Admin',
    description: 'Manage the entire system, users, rooms, and reports.',
    icon: ShieldCheck,
    avatarBg: 'bg-blue-100',
    avatarText: 'text-blue-600',
    badgeColor: 'bg-blue-600',
    badgeIcon: ShieldCheck,
    btnClass: 'bg-[#1E56A0] hover:bg-[#163172] text-white',
    cardBorder: 'border-blue-200 hover:border-blue-400 hover:shadow-blue-100',
    cardBg: 'from-blue-50/60 to-white',
  },
  {
    to: '/staff/login',
    title: 'Warden',
    description: 'Manage rooms, students and hostel activities.',
    icon: UserCog,
    avatarBg: 'bg-emerald-100',
    avatarText: 'text-emerald-700',
    badgeColor: 'bg-emerald-600',
    badgeIcon: Building,
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    cardBorder: 'border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-100',
    cardBg: 'from-emerald-50/60 to-white',
  },
  {
    to: '/student/login',
    title: 'Student',
    description: 'View room details, apply for outpass and more.',
    icon: GraduationCap,
    avatarBg: 'bg-purple-100',
    avatarText: 'text-purple-700',
    badgeColor: 'bg-purple-600',
    badgeIcon: GraduationCap,
    btnClass: 'bg-[#6366F1] hover:bg-[#4F46E5] text-white',
    cardBorder: 'border-purple-200 hover:border-purple-400 hover:shadow-purple-100',
    cardBg: 'from-purple-50/60 to-white',
  },
  {
    to: '/gate/login',
    title: 'Security',
    description: 'Scan QR code, verify outpass and manage entry.',
    icon: ScanLine,
    avatarBg: 'bg-amber-100',
    avatarText: 'text-amber-700',
    badgeColor: 'bg-[#EA580C]',
    badgeIcon: ShieldCheck,
    btnClass: 'bg-[#EA580C] hover:bg-[#C2410C] text-white',
    cardBorder: 'border-amber-200 hover:border-amber-400 hover:shadow-amber-100',
    cardBg: 'from-amber-50/60 to-white',
  },
];

const PortalSelect = () => {
  return (
    <div className="min-h-screen bg-[#F4F8FC] flex flex-col justify-between font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Header matching reference */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-blue-100/60 sticky top-0 z-30 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3.5 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1E56A0] to-[#163172] flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <svg
                className="w-7 h-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9.5L12 3l9 6.5" />
                <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" />
                <path d="M9 21V12h6v9" />
                <path d="M7 16h4" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F2B5C]">
                Hostel Management System
              </span>
              <div className="flex items-center gap-2 text-xs sm:text-[13px] font-medium text-slate-500">
                <span>Safe Stay</span>
                <span className="text-blue-300">|</span>
                <span>Smart Management</span>
                <span className="text-blue-300">|</span>
                <span className="text-blue-600 font-semibold">Better Tomorrow</span>
              </div>
            </div>
          </a>

          <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
              <span className="block font-serif italic text-base font-semibold text-[#1E56A0]">
                "Your Home Away From Home"
              </span>
              <span className="text-xs text-slate-500">Campus Residential Portal</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Building2 size={20} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {/* Hero & Title section matching reference page */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <p className="text-slate-500 text-sm font-semibold tracking-wide uppercase mb-1">
            Welcome to
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F2B5C] tracking-tight">
            Hostel Management System
          </h1>
        </div>

        {/* 4 Cards Grid mirroring Reference Image exactly */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const BadgeIcon = role.badgeIcon;
            return (
              <div
                key={role.title}
                className={`bg-gradient-to-b ${role.cardBg} rounded-3xl p-6 border ${role.cardBorder} shadow-lg shadow-slate-200/50 flex flex-col items-center text-center hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
              >
                {/* Role Avatar with micro-badge */}
                <div className="relative mb-5">
                  <div
                    className={`w-24 h-24 rounded-full ${role.avatarBg} flex items-center justify-center shadow-inner`}
                  >
                    <Icon size={48} className={role.avatarText} />
                  </div>
                  <div
                    className={`absolute bottom-0 right-0 w-8 h-8 rounded-full ${role.badgeColor} text-white flex items-center justify-center border-2 border-white shadow-md`}
                  >
                    <BadgeIcon size={14} />
                  </div>
                </div>

                {/* Role Details */}
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  {role.title}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-1 min-h-[44px]">
                  {role.description}
                </p>

                {/* Action button */}
                <a
                  href={role.to}
                  className={`w-full py-3 px-5 rounded-2xl font-bold text-sm shadow-md transition-all duration-200 flex items-center justify-center gap-2 group ${role.btnClass}`}
                >
                  <span>Login</span>
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </a>
              </div>
            );
          })}
        </div>
      </main>

      {/* Feature Icons Strip mirroring Reference */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-y border-blue-100/70 text-slate-600 text-xs sm:text-sm font-semibold">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <span>Secure Access</span>
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <span>Quick & Easy</span>
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Building2 size={18} />
            </div>
            <span>Smart Hostel</span>
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Users2 size={18} />
            </div>
            <span>Better Communication</span>
          </div>
        </div>
      </section>

      {/* Footer Text matching reference */}
      <footer className="w-full py-5 text-center text-xs text-slate-500">
        <div className="flex items-center justify-center gap-2">
          <div className="w-12 h-px bg-slate-200" />
          <span className="font-medium text-slate-500">
            Designed by Jithendra <span className="text-blue-600" aria-hidden="true">❤</span>
          </span>
          <div className="w-12 h-px bg-slate-200" />
        </div>
      </footer>
    </div>
  );
};

export default PortalSelect;
