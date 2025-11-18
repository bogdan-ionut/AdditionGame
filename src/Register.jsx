import { useState, useRef } from 'react';
import { Upload, User, Calendar, Scroll, Check } from 'lucide-react';
import { showToast } from './lib/ui/toast';

const Register = ({ onRegister, onImport }) => {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const fileInputRef = useRef(null);

  const calculateAge = (dateString) => {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    // Return age with one decimal point
    const monthDiff = (today.getMonth() - birthDate.getMonth() + 12) % 12;
    return parseFloat((age + monthDiff / 12).toFixed(1));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && birthDate && gender) {
      const age = calculateAge(birthDate);
      onRegister({ name, age, gender });
    } else {
      showToast({ level: 'error', message: 'Completează toate câmpurile.' });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-900/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-indigo-500/30 rounded-3xl shadow-2xl p-8 relative z-10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center border border-indigo-500/50">
            <Scroll className="text-indigo-400" size={32} />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white text-center mb-2 font-cinzel">Înregistrare Erou</h1>
        <p className="text-slate-400 text-center mb-8 text-sm">Începe-ți aventura în Tărâmul Cunoașterii</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
              <User size={16} className="text-indigo-400" /> Numele Eroului
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="ex. Darius"
              required
            />
          </div>

          <div>
            <label htmlFor="birthDate" className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-400" /> Data Nașterii
            </label>
            <input
              type="date"
              id="birthDate"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all [color-scheme:dark]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Genul Eroului</label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${gender === 'male' ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-slate-950/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={gender === 'male'}
                  onChange={() => setGender('male')}
                  className="hidden"
                />
                <span className="font-bold">Băiat</span>
                {gender === 'male' && <Check size={16} />}
              </label>

              <label className={`cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${gender === 'female' ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-slate-950/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === 'female'}
                  onChange={() => setGender('female')}
                  className="hidden"
                />
                <span className="font-bold">Fată</span>
                {gender === 'female' && <Check size={16} />}
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-900/40 transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
          >
            Începe Aventura
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10">
          <button
            onClick={handleImportClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-xl border border-white/5 transition-all text-sm font-medium"
          >
            <Upload size={18} />
            <span>Importă progres salvat</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={onImport}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default Register;
