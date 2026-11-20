import { useRef, useState, useEffect } from 'react';
import { useLoanStore } from '../../../store/useLoanStore';
import { Camera, Briefcase, CheckCircle2, Link2, Mail, MapPin, Phone, Save, Trash2, Upload, User, X } from 'lucide-react';
import { gidfineAPI } from '../../../lib/api-gidfine';
import { useTranslation } from '../../../lib/useTranslation';

export default function UserProfile() {
  const { user, setUser } = useLoanStore();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || 'Accra');
  const [salary, setSalary] = useState<number>(user?.salary || 0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Avatar state ── */
  const [avatarSrc, setAvatarSrc] = useState<string>(user?.picture || '');
  const [urlInput, setUrlInput] = useState('');
  const [urlMode, setUrlMode] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    gidfineAPI
      .getBorrowerProfile()
      .then((res: any) => {
        if (!mounted || !res) return;
        const profile = res.profile ?? res;
        if (profile?.monthly_salary_pesewas) setSalary(profile.monthly_salary_pesewas / 100);
        if (profile?.city) setCity(profile.city);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  /* ── Avatar handlers ── */
  const applyAvatar = (src: string) => {
    setAvatarSrc(src);
    setUser({ ...user!, picture: src });
    setAvatarError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setAvatarError('Image must be under 4 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => applyAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUrlApply = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    try { new URL(trimmed); } catch { setAvatarError('Enter a valid URL.'); return; }
    applyAvatar(trimmed);
    setUrlInput('');
    setUrlMode(false);
  };

  const removeAvatar = () => {
    setAvatarSrc('');
    setUser({ ...user!, picture: '' });
  };

  /* ── Profile save ── */
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await gidfineAPI.updateBorrowerProfile({
        fullName: name,
        phone,
        city,
        monthlySalaryPesewas: Math.round(Number(salary) * 100),
      });
      setUser({ ...user!, name, email, phone, city, salary: Number(salary) });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      setError(t('profileSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const fieldCls = 'w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10';
  const labelCls = 'text-xs font-medium uppercase tracking-widest text-gray-500';
  const initial = (name.trim()[0] || email[0] || 'U').toUpperCase();

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="dashboard-heading text-3xl font-semibold tracking-tight">{t('profile')}</h1>
        <p className="dashboard-copy text-sm mt-1">{t('profileIntro')}</p>
      </div>

      {/* ── Avatar card ── */}
      <div className="dashboard-card rounded-2xl border p-6 md:p-8">
        <h2 className="dashboard-heading font-semibold text-base mb-5">Profile photo</h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar preview */}
          <div className="relative shrink-0">
            <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm flex items-center justify-center bg-gradient-to-br from-teal-700 to-teal-600">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Profile" className="h-full w-full object-cover" onError={() => { setAvatarSrc(''); setAvatarError('Could not load image — check the URL.'); }} />
              ) : (
                <span className="text-2xl font-semibold text-white">{initial}</span>
              )}
            </div>
            {/* camera badge */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-gray-900 text-white shadow-md hover:bg-gray-700 transition-colors"
              title="Upload photo"
            >
              <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 w-full sm:w-auto">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Upload className="h-4 w-4" strokeWidth={1.5} /> Upload photo
              </button>
              <button
                type="button"
                onClick={() => { setUrlMode((s) => !s); setAvatarError(null); }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Link2 className="h-4 w-4" strokeWidth={1.5} /> Paste URL
              </button>
              {avatarSrc && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Remove
                </button>
              )}
            </div>

            {/* URL input */}
            {urlMode && (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlApply(); } }}
                  placeholder="https://example.com/avatar.jpg"
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  autoFocus
                />
                <button type="button" onClick={handleUrlApply} className="grid h-10 w-10 place-items-center rounded-xl bg-gray-900 text-white hover:bg-gray-700 transition-colors shrink-0">
                  <Save className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button type="button" onClick={() => { setUrlMode(false); setUrlInput(''); }} className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shrink-0">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            )}

            {avatarError && (
              <p className="text-xs text-red-500 font-medium">{avatarError}</p>
            )}

            <p className="text-xs text-gray-400">JPG, PNG, or GIF · max 4 MB</p>
          </div>
        </div>
      </div>

      {/* ── Info card ── */}
      <div className="dashboard-card rounded-2xl border p-6 md:p-8 space-y-6">
        {/* Success / error banners */}
        {savedSuccess && (
          <div className="p-4 bg-[#f0f9f7] border border-[#b8dbd8] rounded-xl text-[#0a2e2a] font-medium text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} /> {t('profileSaved')}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">{error}</div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Full name */}
            <div className="space-y-1.5">
              <label htmlFor="pf-name" className={labelCls}>{t('fullName')}</label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" strokeWidth={1.5} />
                <input id="pf-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="pf-email" className={labelCls}>{t('emailAddress')}</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" strokeWidth={1.5} />
                <input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label htmlFor="pf-phone" className={labelCls}>{t('phoneNumber')}</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" strokeWidth={1.5} />
                <input id="pf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233 24 123 4567" autoComplete="tel" className={fieldCls} />
              </div>
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <label htmlFor="pf-city" className={labelCls}>{t('city')}</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" strokeWidth={1.5} />
                <input id="pf-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Accra" className={fieldCls} />
              </div>
            </div>

            {/* Income */}
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="pf-income" className={labelCls}>{t('monthlyIncome')} (GH₵)</label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" strokeWidth={1.5} />
                <input id="pf-income" type="number" min={0} value={salary} onChange={(e) => setSalary(Number(e.target.value))} className={fieldCls} />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full h-12 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" strokeWidth={1.5} /> {t('saveProfile')}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
