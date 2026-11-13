import { useState, useEffect } from 'react';
import { useLoanStore } from '../../../store/useLoanStore';
import { User, Phone, Mail, MapPin, Briefcase, CheckCircle2, Save } from 'lucide-react';
import { gidfineAPI } from '../../../lib/api-gidfine';

export default function UserProfile() {
  const { user, setUser } = useLoanStore();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || 'Accra');
  const [salary, setSalary] = useState<number>(user?.salary || 0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      .catch(() => {
        // A borrower without a saved profile yet is fine; keep the form defaults.
      });
    return () => {
      mounted = false;
    };
  }, []);

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
      setError('We could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-medium text-white tracking-tight">Your Profile</h1>
        <p className="text-white/60 text-sm mt-1">Keep your contact and income details up to date.</p>
      </div>

      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-white/10">
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
            <span className="font-display font-bold text-2xl text-white">{(name.charAt(0) || 'U').toUpperCase()}</span>
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg text-white">{name || 'Your name'}</h3>
            <p className="text-xs text-white/50">{email || 'No email set'}</p>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-medium text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" /> Profile saved.
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 font-medium text-xs">{error}</div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="pf-name" className="text-xs font-semibold uppercase tracking-widest text-white/50">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  id="pf-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pf-email" className="text-xs font-semibold uppercase tracking-widest text-white/50">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  id="pf-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pf-phone" className="text-xs font-semibold uppercase tracking-widest text-white/50">Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  id="pf-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+233 24 123 4567"
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pf-city" className="text-xs font-semibold uppercase tracking-widest text-white/50">City</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  id="pf-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Accra"
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="pf-income" className="text-xs font-semibold uppercase tracking-widest text-white/50">Monthly Income (GH₵)</label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-white/30 absolute left-3 top-3.5" />
                <input
                  id="pf-income"
                  type="number"
                  min={0}
                  value={salary}
                  onChange={(e) => setSalary(Number(e.target.value))}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full h-12 bg-white text-black font-semibold rounded-xl hover:bg-white/90 shadow-lg shadow-white/10 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Profile
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
