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
  AlertTriangle, 
  Info, 
  Menu, 
  X, 
  Clock, 
  Shield,
  Euro,
  Users,
  LogOut,
  Lock,
  ChevronRight,
  Trash2,
  Key,
  Save,
  XCircle,
  Loader2
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
const fallbackConfig = {
  apiKey: "AIzaSyA1MuetIpVz6ki2_mdhf4J831oMB8pw39A",
  authDomain: "rotena-519e4.firebaseapp.com",
  projectId: "rotena-519e4",
  storageBucket: "rotena-519e4.firebasestorage.app",
  messagingSenderId: "872970314926",
  appId: "1:872970314926:web:577fcdc52aa0fb2aa7f93f",
  measurementId: "G-ZWFN8WCQFN"
};

let app, auth, db;

// CORRECCIÓN CRÍTICA: Sanitizamos el appId para evitar barras '/' que rompen la ruta de Firebase
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'rotena-app-default';
const appId = rawAppId.replace(/[^a-zA-Z0-9_-]/g, '_'); 

try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : fallbackConfig;
  
  if (firebaseConfig) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    console.warn("Modo offline/demo activado (sin Firebase config).");
  }
} catch (e) {
  console.error("Error inicializando Firebase:", e);
}

// --- CONSTANTES ---
const MASTER_ADMIN_ID = '123';
const MASTER_ADMIN_PASS = 'test';
const LOGO_DRIVE_URL = "https://drive.google.com/uc?export=view&id=1hdKsxPzNRXFE-P5vtvokNBPlwVPI4GH5";

// --- UTILIDADES ---

const getBlockStart = (date) => {
  const d = new Date(date);
  const day = d.getDay(); 
  let diff = 0;
  // Bloque: Jueves a Lunes
  if (day === 4) diff = 0;      // Jueves
  if (day === 5) diff = -1;     // Viernes
  if (day === 6) diff = -2;     // Sábado
  if (day === 0) diff = -3;     // Domingo
  if (day === 1) diff = -4;     // Lunes
  if (day === 2) diff = -5;     // Martes (retrocede al jueves anterior)
  if (day === 3) diff = -6;     // Miércoles (retrocede al jueves anterior)

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
  return diffDays >= 0 && diffDays <= 4; // 0=Jue, 1=Vie, 2=Sab, 3=Dom, 4=Lun
};

// --- COMPONENTE LOGO ---
const UDRLogo = ({ className }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className={`${className} flex items-center justify-center relative min-w-[40px] min-h-[40px] overflow-hidden`}>
        <div className="w-full h-full relative border-2 border-black" style={{
          background: 'linear-gradient(135deg, #ffffff 50%, #d32f2f 50%)',
          clipPath: 'polygon(50% 0, 100% 0, 100% 80%, 50% 100%, 0 80%, 0 0)'
        }}>
          <div className="absolute top-[40%] left-[-10%] w-[120%] h-[20%] bg-yellow-400 border-y border-black transform -rotate-12 z-10 flex items-center justify-center">
             <span className="text-[8px] font-black text-black">P.U.D.R.</span>
          </div>
          <div className="absolute top-0 left-0 w-1/2 h-full bg-green-700/20"></div>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={LOGO_DRIVE_URL} 
      className={className} 
      alt="Escudo P.U.D.R."
      style={{ objectFit: 'contain' }}
      onError={() => setHasError(true)}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  );
};

// --- MODAL RESERVA ---
const Modal = ({ isOpen, onClose, selectedBlock, formData, setFormData, onReservation, isAdminLoggedIn, onConfirmPayment, onCancelReservation }) => {
  if (!isOpen || !selectedBlock) return null;
  
  const res = selectedBlock.reservation;
  let daysLeft = 0;
  if (res && res.createdAt) {
    const diff = (new Date() - res.createdAt.toDate()) / (1000 * 60 * 60 * 24);
    daysLeft = Math.max(0, 5 - Math.ceil(diff));
  }

  const blockEndDate = new Date(selectedBlock.date);
  blockEndDate.setDate(blockEndDate.getDate() + 4); 

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-xl shadow-2xl sm:max-w-md overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl animate-in slide-in-from-bottom duration-300">
        <div className="bg-red-900 p-4 flex justify-between items-center text-white shrink-0">
          <h3 className="font-bold text-lg">{res ? 'Detalle Reserva' : 'Nueva Reserva'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={24} /></button>
        </div>
        
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="text-center mb-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">Fin de Semana Seleccionado</p>
            <p className="text-xl font-bold text-gray-800">
              {formatDisplayDate(selectedBlock.date)} - {formatDisplayDate(blockEndDate)}
            </p>
          </div>

          {!res && (
            <form onSubmit={onReservation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                    <input required type="text" className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Apellidos</label>
                    <input required type="text" className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              
              <label className="flex items-center space-x-3 bg-gray-50 p-4 rounded-lg border border-gray-200 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                  checked={formData.isMember} onChange={e => setFormData({...formData, isMember: e.target.checked})} />
                <span className="text-gray-800 font-bold flex-1">¿Es Socio de la Peña?</span>
              </label>

              {formData.isMember && (
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Número de Socio</label>
                   <input type="number" className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-red-500"
                     value={formData.memberNumber} onChange={e => setFormData({...formData, memberNumber: e.target.value})} placeholder="Opcional" />
                 </div>
              )}

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-yellow-800">Precio Total</span>
                    <span className="text-xl font-black text-yellow-900">{formData.isMember ? '100€' : '300€'}</span>
                </div>
                <p className="text-xs text-yellow-700">El pago debe realizarse en un plazo máximo de 5 días.</p>
              </div>

              <button type="submit" className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all">
                Confirmar Reserva
              </button>
            </form>
          )}

          {res && (
            <div className="space-y-4">
               <div className={`p-4 rounded-xl border-l-4 ${res.status === 'confirmed' ? 'bg-green-50 border-green-500' : 'bg-orange-50 border-orange-500'}`}>
                  <div className="flex items-center gap-2 mb-2">
                      {res.status === 'confirmed' ? <Check className="text-green-600" size={20}/> : <Clock className="text-orange-600" size={20}/>}
                      <span className={`font-bold uppercase text-sm ${res.status === 'confirmed' ? 'text-green-800' : 'text-orange-800'}`}>
                        {res.status === 'confirmed' ? 'Reserva Confirmada' : 'Pendiente de Pago'}
                      </span>
                  </div>
                  {res.status === 'pending' && <p className="text-xs text-orange-800 font-medium pl-7">Caduca en: <strong>{daysLeft} días</strong></p>}
               </div>

               <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Titular:</span> <span className="font-semibold">{res.firstName} {res.lastName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tipo:</span> <span className="font-semibold">{res.isMember ? `Socio ${res.memberNumber ? `(#${res.memberNumber})` : ''}` : 'No Socio'}</span></div>
                  <div className="flex justify-between border-t pt-2 mt-2"><span className="text-gray-500">Importe:</span> <span className="font-bold text-red-700">{res.price}€</span></div>
               </div>

               {isAdminLoggedIn && (
                  <div className="pt-4 border-t space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase text-center">Zona Administración</p>
                      {res.status === 'pending' && (
                          <button onClick={onConfirmPayment} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg flex justify-center gap-2 font-bold text-sm shadow-md">
                              <Check size={18}/> Confirmar Pago Recibido
                          </button>
                      )}
                      <button onClick={onCancelReservation} className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-lg flex justify-center gap-2 font-bold text-sm">
                        <Trash2 size={18}/> Eliminar Reserva
                      </button>
                  </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- PANEL ADMIN ---
const AdminPanel = ({ admins, onExit, onAddAdmin, onDeleteAdmin, onUpdateAdminPass, newAdminData, setNewAdminData, currentAdminId }) => {
  const isMaster = currentAdminId === MASTER_ADMIN_ID;
  const [editingId, setEditingId] = useState(null);
  const [editPassValue, setEditPassValue] = useState("");

  return (
    <div className="p-4 space-y-6 pb-20">
       <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm sticky top-0 z-10 border-b">
         <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Lock size={20}/> Panel Directiva</h2>
         <button onClick={onExit} className="text-red-700 font-bold text-xs bg-red-50 px-3 py-2 rounded-full">Salir</button>
       </div>
       
       <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="mb-6 flex items-center gap-3 text-sm bg-gray-50 p-3 rounded-lg">
             <div className="bg-green-100 text-green-700 p-2 rounded-full"><User size={16}/></div>
             <div><p className="text-xs text-gray-500 uppercase font-bold">Sesión iniciada como</p><p className="font-bold">{currentAdminId === MASTER_ADMIN_ID ? 'Administrador Principal' : `Socio ${currentAdminId}`}</p></div>
          </div>

          {isMaster ? (
             <>
                <div className="space-y-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-800 font-bold uppercase mb-2">Añadir nuevo acceso</p>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Nº Socio" className="w-1/3 p-2 rounded border text-sm" value={newAdminData.id} onChange={(e) => setNewAdminData({...newAdminData, id: e.target.value})} />
                    <input type="text" placeholder="Contraseña" className="flex-1 p-2 rounded border text-sm" value={newAdminData.pass} onChange={(e) => setNewAdminData({...newAdminData, pass: e.target.value})} />
                  </div>
                  <button onClick={onAddAdmin} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-blue-700">Crear Acceso</button>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">Accesos Activos</p>
                  <ul className="space-y-2">
                      {admins.map(a => (
                          <li key={a.id} className="bg-white border p-3 rounded-lg flex justify-between items-center text-sm">
                            <span className="font-mono font-bold text-gray-600">Socio {a.memberId}</span>
                            <div className="flex gap-2 items-center">
                                {editingId === a.id ? (
                                    <div className="flex gap-1">
                                      <input type="text" value={editPassValue} onChange={(e)=>setEditPassValue(e.target.value)} className="w-20 border rounded px-1 text-xs" />
                                      <button onClick={()=>{onUpdateAdminPass(a.id, editPassValue); setEditingId(null)}}><Save size={16} className="text-green-600"/></button>
                                      <button onClick={()=>setEditingId(null)}><XCircle size={16} className="text-gray-400"/></button>
                                    </div>
                                ) : (
                                    <>
                                      <span className="text-xs text-gray-400 mr-2">Pass: {a.password}</span>
                                      <button onClick={()=>{setEditingId(a.id); setEditPassValue(a.password)}}><Key size={16} className="text-blue-500"/></button>
                                      <button onClick={()=>onDeleteAdmin(a.id)}><Trash2 size={16} className="text-red-500"/></button>
                                    </>
                                )}
                            </div>
                          </li>
                      ))}
                      {admins.length === 0 && <p className="text-xs text-gray-400 italic">No hay otros administradores.</p>}
                  </ul>
                </div>
             </>
          ) : (
             <div className="text-center py-8 text-gray-400">
                <Shield size={40} className="mx-auto mb-2 opacity-20"/>
                <p className="text-sm">Tu nivel de acceso es limitado.</p>
             </div>
          )}
       </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // UI State
  const [selectedBlock, setSelectedBlock] = useState(null); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [view, setView] = useState('landing'); 
  const [slideDirection, setSlideDirection] = useState('right');
  
  // Admin State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState('');
  const [adminUser, setAdminUser] = useState({ id: '', pass: '' });
  const [newAdminData, setNewAdminData] = useState({ id: '', pass: '' });

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    isMember: false,
    memberNumber: ''
  });

  // Swipe logic
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) changeMonth('next');
    if (distance < -50) changeMonth('prev');
  };

  const changeMonth = (direction) => {
      setSlideDirection(direction === 'next' ? 'left' : 'right');
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      setCurrentDate(newDate);
  };

  // Auth & Sync
  useEffect(() => {
    if (!auth) return;
    const init = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    };
    init();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    
    // CORRECCIÓN: Manejo de errores en onSnapshot
    const reservationsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'reservations'));
    const unsubRes = onSnapshot(reservationsQuery, (snap) => {
      const resData = [];
      const now = new Date();
      snap.forEach((d) => {
        const data = d.data();
        if (data.status === 'pending' && data.createdAt) {
          if ((now - data.createdAt.toDate()) / (86400000) > 5) {
             deleteDoc(d.ref); 
             return;
          }
        }
        resData.push({ id: d.id, ...data });
      });
      setReservations(resData);
    }, (error) => {
        console.error("Error cargando reservas:", error);
    });

    const adminsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'admins'));
    const unsubAdmins = onSnapshot(adminsQuery, (snap) => {
      const adData = [];
      snap.forEach(d => adData.push({ id: d.id, ...d.data() }));
      setAdmins(adData);
    }, (error) => {
        console.error("Error cargando admins:", error);
    });

    return () => { unsubRes(); unsubAdmins(); };
  }, [user]);

  // Handlers
  const handleDayClick = (day) => {
    const blockStart = getBlockStart(day);
    const blockId = formatDateId(blockStart);
    const existing = reservations.find(r => r.id === blockId);
    setSelectedBlock({ id: blockId, date: blockStart, reservation: existing || null });
    setIsModalOpen(true);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (adminUser.id === MASTER_ADMIN_ID && adminUser.pass === MASTER_ADMIN_PASS) {
      setIsAdminLoggedIn(true); setCurrentAdminId(MASTER_ADMIN_ID); setView('adminPanel'); return;
    }
    const subAdmin = admins.find(a => a.memberId === adminUser.id && a.password === adminUser.pass);
    if (subAdmin) {
       setIsAdminLoggedIn(true); setCurrentAdminId(subAdmin.memberId); setView('adminPanel');
    } else {
       alert('Credenciales incorrectas');
    }
  };

  const handleReservation = async (e) => {
    e.preventDefault();
    if (!selectedBlock) return;
    const price = formData.isMember ? 100 : 300;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.id), {
        startDate: selectedBlock.id, status: 'pending', 
        firstName: formData.firstName, lastName: formData.lastName,
        isMember: formData.isMember, memberNumber: formData.memberNumber || null,
        price, createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setFormData({ firstName: '', lastName: '', isMember: false, memberNumber: '' });
    } catch (err) { console.error(err); }
  };

  const handleAdminActions = async (action, payload) => {
      try {
        if (action === 'addAdmin') await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admins', payload.id), { memberId: payload.id, password: payload.pass });
        if (action === 'deleteAdmin') await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admins', payload));
        if (action === 'updatePass') await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admins', payload.id), { password: payload.newPass });
        if (action === 'confirmPay') { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.id), { status: 'confirmed' }); setIsModalOpen(false); }
        if (action === 'cancelRes') { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.id)); setIsModalOpen(false); }
      } catch(e) { console.error(e); }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Lunes=0
    
    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 sm:h-24 bg-gray-50/30"></div>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const activeRes = reservations.find(r => isDateInBlock(date, r.startDate));
      
      let statusClass = 'bg-white border-gray-100 hover:border-red-300';
      if (activeRes) {
          statusClass = activeRes.status === 'confirmed' 
            ? 'bg-red-50 border-red-200' 
            : 'bg-orange-50 border-orange-200';
      }

      days.push(
        <button 
            key={d} 
            onClick={() => handleDayClick(date)}
            className={`h-20 sm:h-24 p-1 flex flex-col justify-between border rounded-xl transition-all relative overflow-hidden ${statusClass}`}
        >
            <span className={`text-sm font-bold ml-1 mt-1 ${activeRes ? 'text-gray-500' : 'text-gray-800'}`}>{d}</span>
            {activeRes && (
                <div className={`w-full text-[9px] font-bold px-1.5 py-1 rounded-md truncate ${activeRes.status === 'confirmed' ? 'bg-red-100 text-red-900' : 'bg-orange-100 text-orange-900'}`}>
                    {activeRes.status === 'confirmed' ? 'OCUPADO' : 'RESERVADO'}
                </div>
            )}
            {!activeRes && date.getDay() === 4 && ( // Marca visual para Jueves (Inicio de Bloque)
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-400 rounded-full"></div>
            )}
        </button>
      );
    }
    
    return (
        <div 
            className="grid grid-cols-7 gap-2 select-none"
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                <div key={d} className="text-center text-xs font-black text-gray-400 py-2">{d}</div>
            ))}
            {days}
        </div>
    );
  };

  if (!app) return <div className="h-screen flex items-center justify-center flex-col gap-4 bg-slate-50"><Loader2 className="animate-spin text-red-700" size={40}/><p className="text-gray-400 text-sm font-medium">Conectando con la Peña...</p></div>;

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Header fijo solo si no estamos en landing */}
      {view !== 'landing' && (
        <header className="bg-white p-4 sticky top-0 z-40 border-b border-gray-100 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-3" onClick={() => setView('calendar')}>
               <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 shadow-sm p-0.5"><UDRLogo className="w-full h-full object-contain"/></div>
               <div><h1 className="font-black text-sm text-red-900 leading-none">PEÑA UNIÓN</h1><p className="text-[9px] font-bold text-yellow-600 tracking-widest">DEPORTIVA ROTEÑA</p></div>
            </div>
            <button onClick={() => setIsMenuOpen(true)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100"><Menu size={20}/></button>
        </header>
      )}

      {/* Menú Lateral */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsMenuOpen(false)}>
            <div className="absolute right-0 top-0 h-full w-[80%] max-w-sm bg-white shadow-2xl p-6 flex flex-col animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-8 pb-4 border-b"><span className="font-bold text-lg">Menú</span><button onClick={() => setIsMenuOpen(false)}><X size={24}/></button></div>
                <nav className="space-y-2 flex-1">
                    <button onClick={() => {setView('calendar'); setIsMenuOpen(false);}} className="w-full text-left p-4 hover:bg-red-50 rounded-xl flex items-center gap-3 font-bold text-gray-700"><CalendarIcon size={20}/> Calendario</button>
                    <button onClick={() => {setView('rules'); setIsMenuOpen(false);}} className="w-full text-left p-4 hover:bg-red-50 rounded-xl flex items-center gap-3 font-bold text-gray-700"><Shield size={20}/> Normativa</button>
                    {isAdminLoggedIn && <button onClick={() => {setView('adminPanel'); setIsMenuOpen(false);}} className="w-full text-left p-4 bg-gray-900 text-white rounded-xl flex items-center gap-3 font-bold mt-4 shadow-lg"><Lock size={20}/> Panel Directiva</button>}
                </nav>
                <button onClick={() => {setIsAdminLoggedIn(false); setView('landing'); setIsMenuOpen(false);}} className="w-full p-4 bg-red-50 text-red-700 rounded-xl font-bold flex items-center justify-center gap-2"><LogOut size={18}/> Cerrar Sesión</button>
            </div>
        </div>
      )}

      <main className="max-w-md mx-auto min-h-screen">
        {view === 'landing' && (
          <div className="flex flex-col items-center justify-center min-h-screen px-6 animate-in zoom-in-95 duration-500">
            <div className="mb-12 text-center">
              <div className="w-32 h-32 mx-auto bg-white rounded-full shadow-2xl p-4 mb-6 border-4 border-yellow-400 ring-4 ring-red-900/10"><UDRLogo className="w-full h-full object-contain"/></div>
              <h1 className="text-4xl font-black text-red-900 tracking-tight">PEÑA UNIÓN</h1>
              <h2 className="text-sm font-bold text-yellow-600 tracking-[0.4em] mt-2 border-y border-yellow-200 py-1">DEPORTIVA ROTEÑA</h2>
            </div>
            <div className="w-full space-y-4">
              <button onClick={() => setView('calendar')} className="w-full bg-red-600 text-white p-5 rounded-2xl shadow-lg shadow-red-200 flex items-center justify-between group active:scale-95 transition-all">
                <div className="flex items-center gap-4"><div className="bg-red-800/30 p-2 rounded-lg"><User size={24}/></div><div className="text-left"><span className="block font-bold text-lg">Soy Socio</span><span className="text-xs text-red-100">Reservar caseta</span></div></div>
                <ChevronRight className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
              </button>
              <button onClick={() => setView('adminLogin')} className="w-full bg-white border-2 border-gray-100 text-gray-800 p-5 rounded-2xl flex items-center justify-between group active:scale-95 transition-all hover:border-gray-300">
                <div className="flex items-center gap-4"><div className="bg-gray-100 p-2 rounded-lg"><Lock size={24}/></div><div className="text-left"><span className="block font-bold text-lg">Directiva</span><span className="text-xs text-gray-400">Acceso restringido</span></div></div>
                <ChevronRight className="opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
              </button>
            </div>
            <p className="mt-12 text-xs text-gray-300 font-medium">© 2025 Aplicación Oficial</p>
          </div>
        )}

        {view === 'calendar' && (
          <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex justify-between items-center mb-6 bg-gray-50 p-2 rounded-xl">
                <button onClick={() => changeMonth('prev')} className="p-2 hover:bg-white rounded-lg shadow-sm transition-all"><ChevronRight className="rotate-180" size={20}/></button>
                <h2 className="text-lg font-black text-gray-800 uppercase tracking-wider">{currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                <button onClick={() => changeMonth('next')} className="p-2 hover:bg-white rounded-lg shadow-sm transition-all"><ChevronRight size={20}/></button>
             </div>
             
             {renderCalendar()}

             <div className="flex justify-center gap-6 mt-8 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-white border-2 border-gray-200"></div> Libre</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-100 border-2 border-orange-300"></div> Reservado</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-100 border-2 border-red-300"></div> Ocupado</div>
             </div>
          </div>
        )}

        {view === 'rules' && (
          <div className="p-6 pb-20 space-y-6 animate-in slide-in-from-right duration-300">
             <div className="flex items-center gap-3 text-red-900 mb-6"><Shield size={28}/><h2 className="text-2xl font-black">Normativa</h2></div>
             <section className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 text-sm text-gray-600 leading-relaxed">
                <div><h3 className="font-bold text-gray-900 mb-1">1. Uso Exclusivo</h3><p>La caseta es para uso personal de socios, hijos o nietos. El responsable único es el SOCIO titular.</p></div>
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100"><h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2"><Euro size={16}/> Tarifas y Pagos</h3><div className="flex justify-between items-center mb-2"><span className="text-gray-600">Socio</span><span className="font-bold text-lg text-gray-900">100€</span></div><div className="flex justify-between items-center border-t border-yellow-200 pt-2"><span className="text-gray-600">No Socio</span><span className="font-bold text-lg text-gray-900">300€</span></div><p className="text-xs text-yellow-700 mt-3 font-medium">* El pago debe realizarse en máx. 5 días.</p></div>
                <div><h3 className="font-bold text-gray-900 mb-1">2. Cancelaciones</h3><ul className="list-disc pl-4 space-y-1"><li>Con aviso previo (10 días): Devolución posible.</li><li>Larga duración: Aviso con 1 mes.</li></ul></div>
             </section>
             <button onClick={() => setView('calendar')} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold">Volver</button>
          </div>
        )}

        {view === 'adminLogin' && (
            <div className="p-6 min-h-[80vh] flex flex-col justify-center animate-in zoom-in-95">
                <button onClick={() => setView('landing')} className="absolute top-6 left-6 p-2 bg-gray-100 rounded-full"><ChevronRight className="rotate-180" size={20}/></button>
                <div className="text-center mb-8"><div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl text-white"><Lock size={28}/></div><h2 className="text-2xl font-black text-gray-900">Acceso Directiva</h2><p className="text-gray-400 text-sm">Introduce tus credenciales</p></div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <input type="text" placeholder="ID Socio" className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-gray-900 rounded-xl p-4 font-bold text-center outline-none transition-all" value={adminUser.id} onChange={e => setAdminUser({...adminUser, id: e.target.value})}/>
                    <input type="password" placeholder="Contraseña" className="w-full bg-gray-50 border-2 border-transparent focus:bg-white focus:border-gray-900 rounded-xl p-4 font-bold text-center outline-none transition-all" value={adminUser.pass} onChange={e => setAdminUser({...adminUser, pass: e.target.value})}/>
                    <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-red-700 active:scale-95 transition-all">Entrar</button>
                </form>
            </div>
        )}
        
        {view === 'adminPanel' && (
          <AdminPanel 
            admins={admins} onExit={() => setView('calendar')} 
            onAddAdmin={() => handleAdminActions('addAdmin', newAdminData)}
            onDeleteAdmin={(id) => handleAdminActions('deleteAdmin', id)}
            onUpdateAdminPass={(id, newPass) => handleAdminActions('updatePass', {id, newPass})}
            newAdminData={newAdminData} setNewAdminData={setNewAdminData} currentAdminId={currentAdminId}
          />
        )}
      </main>

      <Modal 
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        selectedBlock={selectedBlock} formData={formData} setFormData={setFormData}
        onReservation={handleReservation} isAdminLoggedIn={isAdminLoggedIn}
        onConfirmPayment={() => handleAdminActions('confirmPay')}
        onCancelReservation={() => handleAdminActions('cancelRes')}
      />
    </div>
  );
}
