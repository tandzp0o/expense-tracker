import React from "react";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mx-auto py-8 border-t border-slate-100 dark:border-slate-800/50">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
                <span className="text-primary font-bold">FinTrack</span>
                <span className="opacity-60">© {currentYear}</span>
            </div>
            
            <div className="flex items-center gap-6">
                <a href="#" className="hover:text-primary transition-colors">Chính sách</a>
                <a href="#" className="hover:text-primary transition-colors">Điều khoản</a>
                <a href="#" className="size-7 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>support_agent</span>
                </a>
            </div>

            <div className="text-slate-400">
                Developed by <span className="text-primary font-medium">FinTrack Team</span>
            </div>
        </div>
    </footer>
  );
};

export default Footer;
