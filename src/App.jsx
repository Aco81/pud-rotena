import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  User, 
  Check, 
  Clock, 
  Menu, 
  X, 
  Shield,
  Euro,
  Users,
  LogOut,
  Lock,
  ChevronRight,
  Trash2,
  Key,
  Save,
  XCircle
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyA1MuetIpVz6ki2_mdhf4J831oMB8pw39A",
  authDomain: "rotena-519e4.firebaseapp.com",
  projectId: "rotena-519e4",
  storageBucket: "rotena-519e4.firebasestorage.app",
  messagingSenderId: "872970314926",
  appId: "1:872970314926:web:577fcdc52aa0fb2aa7f93f",
  measurementId: "G-ZWFN8WCQFN"
};

// --- CONSTANTS ---
const MASTER_ADMIN_ID = '123';
const MASTER_ADMIN_PASS = 'test';

// --- UTILS & HELPERS ---

// Calcula el inicio del bloque (Jueves)
const getBlockStart = (date) => {
  const d = new Date(date);
  const day = d.getDay(); 
  let diff = 0;
  // Lógica para agrupar Jueves-Lunes como un bloque
  if (day === 4) diff = 0; // Jueves
  if (day === 5) diff = -1; // Viernes
  if (day === 6) diff = -2; // Sábado
  if (day === 0) diff = -3; // Domingo
  if (day === 1) diff = -4; // Lunes
  if (day === 2) diff = -5; // Martes (Anterior)
  if (day === 3) diff = -6; // Miércoles (Anterior)

  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const formatDateId = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (date) => {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const isDateInBlock = (checkDate, blockStartDateStr) => {
  if (!blockStartDateStr) return false;
  const blockStart = new Date(blockStartDateStr);
  const check = new Date(checkDate);
  check.setHours(0,0,0,0);
  const diffTime = check - blockStart;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  // El bloque dura 5 días (Jueves a Lunes inclusive)
  return diffDays >= 0 && diffDays <= 4;
};

// --- LOGO VECTORIAL P.U.D.R. ---
const LogoPUDR = ({ className }) => (
  <svg viewBox="0 0 200 240" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <path id="shield" d="M10,10 Q100,30 190,10 V80 Q190,170 100,235 Q10,170 10,80 Z" />
    </defs>
    
    {/* Borde Negro */}
    <use href="#shield" fill="black" stroke="black" strokeWidth="8" />
    
    <g clipPath="url(#clip)">
       <clipPath id="clip"><use href="#shield"/></clipPath>
       <rect width="200" height="240" fill="white"/>

       {/* Arriba Izquierda: Franjas Verdes */}
       <rect x="0" y="0" width="100" height="120" fill="white"/>
       <rect x="20" y="0" width="20" height="120" fill="#008000"/>
       <rect x="60" y="0" width="20" height="120" fill="#008000"/>
       <path d="M100,0 V120" stroke="black" strokeWidth="2"/>

       {/* Arriba Derecha: Castillo */}
       <rect x="100" y="0" width="100" height="75" fill="white"/>
       <rect x="100" y="75" width="100" height="45" fill="#00BFFF"/>
       {/* Castillo simple */}
       <path d="M135,75 V55 H138 V50 H142 V55 H158 V50 H162 V55 H165 V75 Z" fill="#FFD700" stroke="black" strokeWidth="1"/>
       <rect x="145" y="65" width="10" height="10" fill="white" stroke="black" strokeWidth="1"/>

       {/* Abajo: Rojo */}
       <path d="M0,120 H200 V240 H0 Z" fill="#D32F2F"/>
       <path d="M100,120 V240" stroke="black" strokeWidth="2"/>

       {/* Banda Amarilla */}
       <path d="M-20,90 L220,160 L220,120 L-20,50 Z" fill="#FFD700" stroke="black" strokeWidth="2"/>
       
       {/* Texto P.U.D.R. */}
       <text x="45" y="132" fontSize="30" fontWeight="900" fontFamily="serif" fill="black" transform="rotate(16 100 120)">P.U.D.R.</text>

       {/* Balón */}
       <g transform="translate(100, 185)">
          <circle r="22" fill="white" stroke="black" strokeWidth="2"/>
          <path d="M-15,-10 Q0,0 15,-10" fill="none" stroke="black" strokeWidth="1"/>
          <path d="M-18,5 Q0,15 18,5" fill="none" stroke="black" strokeWidth="1"/>
          <path d="M0,-22 V22" fill="none" stroke="black" opacity="0.3"/>
       </g>
    </g>
    <use href="#shield" fill="none" stroke="black" strokeWidth="6" />
  </svg>
);

// --- COMPONENTES PRINCIPALES ---

const Modal = ({ 
  isOpen, 
  onClose, 
  selectedBlock, 
  formData, 
  setFormData, 
  onReservation, 
  isAdminLoggedIn,
  onConfirmPayment, 
  onCancelReservation 
}) => {
  if (!isOpen || !selectedBlock) return null;
  
  const res = selectedBlock.reservation;
  const blockEndDate = new Date(selectedBlock.date);
  blockEndDate.setDate(blockEndDate.getDate() + 4); 

  let daysLeft = 0;
  if (res && res.createdAt) {
    const diff = (new Date() - res.createdAt.toDate()) / (1000 * 60 * 60 * 24);
    daysLeft = Math.max(0, 5 - Math.ceil(diff));
  }

  // Safe area padding for bottom of modal
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in pb-[env(safe-area-inset-bottom)] sm:pb-4">
      <div className="bg-white w-full sm:rounded-xl shadow-2xl sm:max-w-md overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl animate-slide-up sm:animate-none">
        <div className="bg-red-900 p-4 flex justify-between items-center text-white shrink-0">
          <h3 className="font-bold text-lg">
            {res ? 'Detalle Reserva' : 'Nueva Reserva'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full"><X size={24} /></button>
        </div>
        
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="text-center mb-2">
            <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Fin de Semana</p>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {formatDisplayDate(selectedBlock.date)} - {formatDisplayDate(blockEndDate)}
            </p>
          </div>

          {!res ? (
            <form onSubmit={onReservation} className="space-y-4">
              {/* text-base prevents auto-zoom on iPhone */}
              <input required type="text" className="w-full border p-3 rounded-lg text-base" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} placeholder="Nombre" />
              <input required type="text" className="w-full border p-3 rounded-lg text-base" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} placeholder="Apellidos" />
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <input type="checkbox" className="w-5 h-5 text-red-600 rounded" checked={formData.isMember} onChange={e => setFormData({...formData, isMember: e.target.checked})} />
                <label className="text-gray-700 font-medium">¿Es Socio?</label>
              </div>
              {formData.isMember && (
                 <input type="text" className="w-full border p-3 rounded-lg text-base" value={formData.memberNumber} onChange={e => setFormData({...formData, memberNumber: e.target.value})} placeholder="Nº Socio (Opcional)" />
              )}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 text-sm text-yellow-900">
                <p className="font-bold flex items-center gap-2"><Euro size={16}/> {formData.isMember ? '100,00€' : '300,00€'}</p>
                <p className="mt-1 text-xs">Pago en máx. 5 días o se anula.</p>
              </div>
              <button type="submit" className="w-full bg-red-700 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-red-800 transition-colors">Confirmar</button>
            </form>
          ) : (
            <div className="space-y-4">
               <div className={`p-4 rounded-xl border-l-4 ${res.status === 'confirmed' ? 'bg-green-50 border-green-500' : 'bg-orange-50 border-orange-500'}`}>
                  <div className="flex items-center gap-2 mb-2">
                      {res.status === 'confirmed' ? <Check className="text-green-600"/> : <Clock className="text-orange-600"/>}
                      <span className="font-bold uppercase">{res.status === 'confirmed' ? 'Pagado' : 'Pendiente'}</span>
                  </div>
                  {res.status === 'pending' && <p className="text-sm text-orange-800 font-medium pl-8">Caduca en: <strong>{daysLeft}</strong> días</p>}
               </div>
               <div className="bg-gray-50 p-4 rounded-xl space-y-2 border">
                  <p><strong>Titular:</strong> {res.firstName} {res.lastName}</p>
                  <p><strong>Tipo:</strong> {res.isMember ? 'Socio' : 'No Socio'}</p>
                  <p><strong>Importe:</strong> {res.price}€</p>
                  {res.isMember && res.memberNumber && <p><strong>Nº Socio:</strong> {res.memberNumber}</p>}
               </div>
               {isAdminLoggedIn && (
                  <div className="pt-4 border-t space-y-2">
                      {res.status === 'pending' && (
                          <button onClick={onConfirmPayment} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"><Check size={18}/> Confirmar Pago</button>
                      )}
                      <button onClick={onCancelReservation} className="w-full bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"><Trash2 size={18}/> Cancelar Reserva</button>
                  </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminPanel = ({ admins, onExit, onAddAdmin, onDeleteAdmin, onUpdateAdminPass, newAdminData, setNewAdminData, currentAdminId }) => {
  const isMaster = currentAdminId === MASTER_ADMIN_ID;
  const [editingId, setEditingId] = useState(null);
  const [editPassValue, setEditPassValue] = useState("");

  return (
    <div className="p-4 pb-24 space-y-6">
       <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
         <h2 className="text-lg font-bold text-gray-800">Panel Admin</h2>
         <button onClick={onExit} className="text-red-700 font-bold text-sm flex items-center gap-2"><LogOut size={16}/> Salir</button>
       </div>
       <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-4">Conectado como: <strong>{isMaster ? 'Master (123)' : `Socio ${currentAdminId}`}</strong></p>
          {isMaster ? (
             <>
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-bold text-gray-800 mb-2 text-sm uppercase">Añadir Admin</h3>
                    <div className="flex flex-col gap-2">
                        <input type="text" placeholder="Nº Socio" className="border p-2 rounded text-base" value={newAdminData.id} onChange={(e) => setNewAdminData({...newAdminData, id: e.target.value})} />
                        <input type="text" placeholder="Contraseña" className="border p-2 rounded text-base" value={newAdminData.pass} onChange={(e) => setNewAdminData({...newAdminData, pass: e.target.value})} />
                        <button onClick={onAddAdmin} className="bg-gray-900 text-white py-2 rounded font-bold hover:bg-gray-800">Añadir</button>
                    </div>
                </div>
                
                <h3 className="font-bold text-gray-800 mb-2 text-sm uppercase">Lista Admins</h3>
                <ul className="space-y-2">
                    <li className="bg-gray-50 p-2 rounded flex justify-between text-sm items-center border border-gray-200">
                        <span>Master (123)</span> 
                        <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded text-[10px] font-bold">PRINCIPAL</span>
                    </li>
                    {admins.map(a => (
                        <li key={a.id} className="bg-white border p-2 rounded flex flex-col gap-2 text-sm">
                           <div className="flex justify-between items-center">
                              <span className="font-bold text-gray-700">Socio {a.memberId}</span>
                              <div className="flex gap-2">
                                 {editingId === a.id ? (
                                    <>
                                        <button onClick={() => {onUpdateAdminPass(a.id, editPassValue); setEditingId(null);}} className="text-green-600 p-1 hover:bg-green-50 rounded"><Save size={16}/></button>
                                        <button onClick={() => setEditingId(null)} className="text-gray-500 p-1 hover:bg-gray-100 rounded"><XCircle size={16}/></button>
                                    </>
                                 ) : (
                                    <>
                                        <button onClick={() => {setEditingId(a.id); setEditPassValue(a.password);}} className="text-blue-600 p-1 hover:bg-blue-50 rounded"><Key size={16}/></button>
                                        <button onClick={() => onDeleteAdmin(a.id)} className="text-red-600 p-1 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                    </>
                                 )}
                              </div>
                           </div>
                           {editingId === a.id ? (
                               <input value={editPassValue} onChange={e=>setEditPassValue(e.target.value)} className="border p-1 rounded w-full mt-1 text-base" autoFocus/>
                           ) : (
                               <span className="text-xs text-gray-400 font-mono">Pass: {a.password}</span>
                           )}
                        </li>
                    ))}
                </ul>
             </>
          ) : <p className="text-center text-gray-400 italic">Solo el Admin Principal puede gestionar usuarios.</p>}
       </div>
    </div>
  );
};

// --- APP PRINCIPAL ---

export default function App() {
  const [user, setUser] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [selectedBlock, setSelectedBlock] = useState(null); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [view, setView] = useState('landing'); 
  const [slideDirection, setSlideDirection] = useState('');
  
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState('');
  const [adminUser, setAdminUser] = useState({ id: '', pass: '' });
  const [newAdminData, setNewAdminData] = useState({ id: '', pass: '' });
  const [formData, setFormData] = useState({ firstName: '', lastName: '', isMember: false, memberNumber: '' });

  // Swipe logic
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) changeMonth('next');
    if (distance < -50) changeMonth('prev');
    setTouchStart(null);
    setTouchEnd(null);
  };

  const changeMonth = (dir) => {
      setSlideDirection(dir === 'next' ? 'left' : 'right');
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + (dir === 'next' ? 1 : -1));
      setTimeout(() => setCurrentDate(newDate), 0);
  };

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const unsubRes = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'reservations')), (snap) => {
      const data = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()}));
      setReservations(data);
    });
    const unsubAdmins = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'admins')), (snap) => {
      const data = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()}));
      setAdmins(data);
    });
    return () => { unsubRes(); unsubAdmins(); };
  }, [user]);

  const handleLogin = (e) => {
    e.preventDefault();
    // 1. Check Master Admin
    if (adminUser.id === MASTER_ADMIN_ID && adminUser.pass === MASTER_ADMIN_PASS) {
      setIsAdminLoggedIn(true);
      setCurrentAdminId(MASTER_ADMIN_ID);
      setView('adminPanel');
      return;
    }
    // 2. Check Database Admins
    const valid = admins.find(a => a.memberId === adminUser.id && a.password === adminUser.pass);
    if (valid) {
       setIsAdminLoggedIn(true);
       setCurrentAdminId(valid.memberId);
       setView('adminPanel');
    } else {
        alert("Credenciales incorrectas");
    }
  };

  const handleLogout = () => {
      setIsAdminLoggedIn(false);
      setCurrentAdminId('');
      setAdminUser({ id: '', pass: '' });
      setIsMenuOpen(false);
      setView('landing');
  };

  const handleReservation = async (e) => {
    e.preventDefault();
    if (!selectedBlock || !db) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.id), {
        startDate: selectedBlock.id,
        status: 'pending', 
        firstName: formData.firstName,
        lastName: formData.lastName,
        isMember: formData.isMember,
        memberNumber: formData.memberNumber || null,
        price: formData.isMember ? 100 : 300,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setFormData({ firstName: '', lastName: '', isMember: false, memberNumber: '' });
    } catch(e) { console.error(e); }
  };

  // --- MISSING HANDLERS IMPLEMENTATION ---
  
  const handleAddAdmin = async () => {
      if (!newAdminData.id || !newAdminData.pass) return;
      try {
          // Use memberId as the document ID for uniqueness and easy lookup
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admins', newAdminData.id), {
              memberId: newAdminData.id,
              password: newAdminData.pass
          });
          setNewAdminData({ id: '', pass: '' });
      } catch (e) {
          console.error("Error adding admin:", e);
      }
  };

  const handleConfirmPayment = async () => {
      if (!selectedBlock || !selectedBlock.reservation) return;
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.reservation.id), {
              status: 'confirmed'
          });
          // Close modal or update local state logic if needed
          setIsModalOpen(false);
      } catch (e) {
          console.error("Error confirming payment:", e);
      }
  };

  const handleCancelReservation = async () => {
      if (!selectedBlock || !selectedBlock.reservation) return;
      if (!confirm("¿Seguro que quieres eliminar esta reserva?")) return;
      try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.reservation.id));
          setIsModalOpen(false);
      } catch (e) {
          console.error("Error canceling reservation:", e);
      }
  };

  // Render Calendar Helper
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Logic to properly align the grid
    const firstDayObj = new Date(year, month, 1);
    let firstDayOfWeek = firstDayObj.getDay(); // 0 (Sun) to 6 (Sat)
    // Adjust to start on Monday (0) to Sunday (6) for grid logic
    // JS getDay(): Sun=0, Mon=1...Sat=6
    // We want Mon=0...Sun=6
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Empty cells for days before the 1st
    for (let i = 0; i < startOffset; i++) {
        days.push(<div key={`e-${i}`} className="h-16 border-r border-b bg-gray-50/50"/>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const blockStart = getBlockStart(date);
        const blockId = formatDateId(blockStart);
        const res = reservations.find(r => r.id === blockId);
        const isBlock = isDateInBlock(date, blockId);
        
        let bg = 'bg-white';
        let txt = 'text-gray-400';
        let clickAction = null;

        if (isBlock) {
            txt = 'text-gray-800 font-bold';
            // Only clickable if it's a valid block day
            clickAction = () => {
                setSelectedBlock({id: blockId, date: blockStart, reservation: res});
                setIsModalOpen(true);
            };

            if (!res) { 
                bg = 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer transition-colors'; 
            } else if (res.status === 'pending') { 
                bg = 'bg-orange-50 text-orange-700 hover:bg-orange-100 cursor-pointer transition-colors'; 
            } else { 
                bg = 'bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer transition-colors'; 
            }
        }

        days.push(
            <div key={d} onClick={clickAction} className={`h-16 border-r border-b flex flex-col items-center justify-center relative ${bg}`}>
                <span className={txt}>{d}</span>
                {isBlock && res && (
                    <div className={`w-2 h-2 rounded-full mt-1 ${res.status==='confirmed' ? 'bg-red-600' : 'bg-orange-400 animate-pulse'}`}/>
                )}
            </div>
        );
    }
    return <div className="grid grid-cols-7 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">{days}</div>;
  };

  if (!app && typeof __firebase_config !== 'undefined') return <div className="p-10 text-center flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-900"></div></div>;

  // Uses 'dvh' for dynamic viewport height on mobile
  // Uses padding-top env() for notch
  return (
    <div className="min-h-[100dvh] bg-gray-50 font-sans pb-[env(safe-area-inset-bottom)] select-none">
      <style>{`
        .animate-slide-in-right { animation: slideInRight 0.3s ease-out forwards; } 
        .animate-slide-in-left { animation: slideInLeft 0.3s ease-out forwards; } 
        @keyframes slideInRight { from { transform: translateX(20%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } 
        @keyframes slideInLeft { from { transform: translateX(-20%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {view !== 'landing' && (
        <header className="bg-white px-4 py-3 shadow-sm sticky top-0 z-40 flex justify-between items-center border-b border-red-100 pt-[calc(0.75rem+env(safe-area-inset-top))]">
           <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('calendar')}>
              <div className="w-10 h-12 group-hover:scale-110 transition-transform"><LogoPUDR className="w-full h-full"/></div>
              <div><h1 className="font-bold text-red-900 leading-none text-lg">Peña Unión</h1><h2 className="text-[10px] text-yellow-600 font-bold uppercase tracking-widest">Deportiva Roteña</h2></div>
           </div>
           <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-gray-100 rounded-full active:bg-gray-200"><Menu className="text-gray-700"/></button>
        </header>
      )}

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsMenuOpen(false)}>
           <div className="absolute right-0 h-full w-[80%] max-w-sm bg-white shadow-2xl p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-slide-in-right" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between mb-8 items-center">
                  <span className="font-bold text-xl text-gray-800">Menú</span>
                  <button onClick={() => setIsMenuOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X/></button>
              </div>
              <nav className="space-y-6">
                 <button onClick={() => {setView('calendar'); setIsMenuOpen(false)}} className="w-full text-left font-bold text-gray-700 flex gap-4 text-lg items-center hover:text-red-700"><CalendarIcon className="text-red-800"/> Calendario</button>
                 <button onClick={() => {setView('rules'); setIsMenuOpen(false)}} className="w-full text-left font-bold text-gray-700 flex gap-4 text-lg items-center hover:text-red-700"><Shield className="text-red-800"/> Normativa</button>
                 {isAdminLoggedIn && <button onClick={() => {setView('adminPanel'); setIsMenuOpen(false)}} className="w-full text-left font-bold text-red-900 flex gap-4 text-lg items-center"><Users/> Panel Admin</button>}
              </nav>
              <div className="mt-12 border-t pt-6">
                  {isAdminLoggedIn ? (
                      <button onClick={handleLogout} className="text-red-600 font-bold flex gap-2 items-center w-full justify-center border border-red-200 p-3 rounded-xl hover:bg-red-50"><LogOut/> Cerrar Sesión</button>
                  ) : (
                      <button onClick={() => {setView('adminLogin'); setIsMenuOpen(false)}} className="text-gray-500 font-medium text-sm flex gap-2 items-center w-full justify-center hover:text-gray-800"><Lock size={14}/> Acceso Directiva</button>
                  )}
              </div>
           </div>
        </div>
      )}

      <main className="max-w-md mx-auto">
         {view === 'landing' && (
            <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 animate-fade-in">
               <div className="w-48 h-56 mb-8 drop-shadow-xl"><LogoPUDR className="w-full h-full"/></div>
               <h1 className="text-4xl font-black text-red-900 text-center mb-1 leading-tight">P.U.D.<br/>ROTEÑA</h1>
               <p className="text-yellow-600 font-bold tracking-[0.3em] text-xs mb-12">DESDE 1978</p>
               
               <div className="w-full space-y-4">
                  <button onClick={() => setView('calendar')} className="w-full bg-white border border-red-100 p-5 rounded-2xl shadow-lg hover:shadow-xl hover:border-red-300 transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                          <div className="bg-red-50 p-3 rounded-full"><User className="text-red-700" size={24}/></div>
                          <div className="text-left"><span className="block font-bold text-lg text-gray-800">Soy Socio</span><span className="text-xs text-gray-500">Reservar caseta</span></div>
                      </div>
                      <ChevronRight className="text-gray-300 group-hover:text-red-500 transition-colors"/>
                  </button>
                  <button onClick={() => setView('adminLogin')} className="w-full bg-gray-900 text-white p-5 rounded-2xl shadow-lg hover:bg-black transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                          <div className="bg-gray-700 p-3 rounded-full"><Lock size={24}/></div> 
                          <div className="text-left"><span className="block font-bold text-lg">Directiva</span><span className="text-xs text-gray-400">Acceso admin</span></div>
                      </div>
                      <ChevronRight className="text-gray-500 group-hover:text-white transition-colors"/>
                  </button>
               </div>
            </div>
         )}

         {view === 'calendar' && (
            <div className="p-4 space-y-4" onTouchStart={e => setTouchStart(e.targetTouches[0].clientX)} onTouchMove={e => setTouchEnd(e.targetTouches[0].clientX)} onTouchEnd={onTouchEnd}>
               <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                  <button onClick={() => changeMonth('prev')} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight className="rotate-180"/></button>
                  <h2 className="text-lg font-black uppercase tracking-wide text-gray-800">{currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                  <button onClick={() => changeMonth('next')} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight/></button>
               </div>
               <div className={`transition-all duration-300 ${slideDirection==='left'?'animate-slide-in-right':'animate-slide-in-left'}`}>
                  <div className="grid grid-cols-7 bg-red-900 text-white text-center py-2 text-xs font-bold rounded-t-xl">
                     {['L','M','X','J','V','S','D'].map(d=><div key={d}>{d}</div>)}
                  </div>
                  {renderCalendar()}
               </div>
               <div className="flex justify-between text-xs text-center px-4 pt-2 text-gray-600 font-medium">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"/> Libre</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-orange-400 rounded-full shadow-sm"/> Pendiente</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-full shadow-sm"/> Pagado</div>
               </div>
            </div>
         )}

         {view === 'rules' && (
            <div className="p-6 space-y-8 bg-white min-h-[100dvh]">
               <div className="flex justify-between items-center border-b pb-4"><h2 className="text-2xl font-black text-red-900">Normativa</h2><button onClick={() => setView('calendar')} className="bg-gray-100 p-2 rounded-full"><X/></button></div>
               
               <div className="space-y-6">
                   <div className="bg-red-50 p-5 rounded-2xl border border-red-100">
                      <h3 className="font-bold flex gap-2 text-lg text-red-800 mb-2"><User size={24}/> Uso Exclusivo</h3>
                      <p className="text-gray-700 leading-relaxed">El alquiler es exclusivo para <span className="font-bold">socios, hijos o nietos</span>. El responsable final ante la peña será siempre el socio titular.</p>
                   </div>
                   
                   <div>
                      <h3 className="font-bold flex gap-2 text-lg text-gray-800 mb-4"><Euro size={24} className="text-red-700"/> Tarifas de Alquiler</h3>
                      <div className="grid grid-cols-2 gap-4 text-center">
                         <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 ring-2 ring-transparent hover:ring-red-100 transition-all">
                             <span className="text-sm text-gray-500 uppercase font-bold tracking-wider">Socio</span>
                             <div className="text-3xl font-black text-red-900 mt-2">100€</div>
                         </div>
                         <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 ring-2 ring-transparent hover:ring-red-100 transition-all">
                             <span className="text-sm text-gray-500 uppercase font-bold tracking-wider">No Socio</span>
                             <div className="text-3xl font-black text-gray-800 mt-2">300€</div>
                         </div>
                      </div>
                   </div>

                   <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600 flex gap-3">
                       <Clock className="shrink-0 text-orange-500"/>
                       <p>Recuerda realizar el pago en un máximo de <span className="font-bold text-gray-800">5 días</span> tras la reserva o esta será anulada automáticamente.</p>
                   </div>
               </div>
               
               <button onClick={() => setView('calendar')} className="w-full bg-red-900 text-white py-4 rounded-xl font-bold shadow-lg mt-8 hover:bg-red-800 transition-colors">Volver al Calendario</button>
            </div>
         )}

         {view === 'adminPanel' && <AdminPanel admins={admins} onExit={handleLogout} onAddAdmin={handleAddAdmin} onDeleteAdmin={async(id)=>{if(confirm("¿Borrar admin?")) try{await deleteDoc(doc(db,'artifacts',appId,'public','data','admins',id))}catch(e){}}} onUpdateAdminPass={async(id,p)=>{try{await updateDoc(doc(db,'artifacts',appId,'public','data','admins',id),{password:p})}catch(e){}}} newAdminData={newAdminData} setNewAdminData={setNewAdminData} currentAdminId={currentAdminId} />}

         {view === 'adminLogin' && (
            <div className="flex flex-col items-center justify-center min-h-[80dvh] p-6 animate-fade-in">
               <div className="bg-white p-8 rounded-2xl shadow-xl w-full border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-red-900"/>
                  <h2 className="text-2xl font-black text-center mb-6 text-gray-800">Acceso Admin</h2>
                  <form onSubmit={handleLogin} className="space-y-4">
                     <div>
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Usuario / Nº Socio</label>
                        <input type="text" className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-lg text-center font-bold text-lg focus:border-red-900 focus:outline-none focus:bg-white transition-colors text-base" value={adminUser.id} onChange={e => setAdminUser({...adminUser, id: e.target.value})} />
                     </div>
                     <div>
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Contraseña</label>
                        <input type="password" className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-lg text-center font-bold text-lg focus:border-red-900 focus:outline-none focus:bg-white transition-colors text-base" value={adminUser.pass} onChange={e => setAdminUser({...adminUser, pass: e.target.value})} />
                     </div>
                     <button type="submit" className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg">Entrar</button>
                  </form>
                  <button onClick={() => setView('landing')} className="w-full text-center mt-6 text-gray-400 text-sm font-medium hover:text-red-700">Cancelar</button>
               </div>
            </div>
         )}
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} selectedBlock={selectedBlock} formData={formData} setFormData={setFormData} onReservation={handleReservation} isAdminLoggedIn={isAdminLoggedIn} onConfirmPayment={handleConfirmPayment} onCancelReservation={handleCancelReservation} />
    </div>
  );
}
