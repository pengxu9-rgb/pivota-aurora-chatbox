import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-chat px-4">
      <div className="w-full max-w-sm rounded-[24px] border border-border/60 bg-card/85 p-6 text-center shadow-card">
        <h1 className="text-5xl font-semibold tracking-[-0.03em] text-foreground">404</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">{t('notfound.message')}</p>
        <Link className="aurora-home-role-primary mt-5 inline-flex rounded-full px-4 py-2.5 text-[14px] font-semibold shadow-card" to="/">
          {t('notfound.return_home')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
