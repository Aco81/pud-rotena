import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
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
  AlertTriangle, 
  Info, 
  Menu, 
  X, 
  Shield, 
  Euro, 
  LogOut, 
  Lock, 
  ChevronRight 
} from 'lucide-react';

console.log("[App.jsx] Cargando versión final corregida...");

// --- VARIABLES GLOBALES ---
let app = null;
let auth = null;
let db = null;

const firebaseConfig = {
  apiKey: "AIzaSyA1MuetIpVz6ki2_mdhf4J831oMB8pw39A",
  authDomain: "rotena-519e4.firebaseapp.com",
  projectId: "rotena-519e4",
  storageBucket: "rotena-519e4.firebasestorage.app",
  messagingSenderId: "872970314926",
  appId: "1:872970314926:web:577fcdc52aa0fb2aa7f93f",
  measurementId: "G-ZWFN8WCQFN"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'rotena-public';
const MASTER_ADMIN_ID = '123';
const MASTER_ADMIN_PASS = 'test';
const LOGO_DRIVE_URL = "https://drive.google.com/uc?export=view&id=1hdKsxPzNRXFE-P5vtvokNBPlwVPI4GH5";

// --- UTILIDADES ---
const getBlockStart = (date) => {
  const d = new Date(date);
  const day = d.getDay(); 
  let diff = 0;
  if (day === 4) diff = 0;      
  if (day === 5) diff = -1;     
  if (day === 6) diff = -2;     
  if (day === 0) diff = -3;     
  if (day === 1) diff = -4;     
  if (day === 2) diff = -5;     
  if (day === 3) diff = -6;     
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

const isDateInBlock = (checkDate, blockStartDateStr) => {
  if (!blockStartDateStr) return false;
  const blockStart = new Date(blockStartDateStr);
  const check = new Date(checkDate);
  check.setHours(0,0,0,0);
  const diffTime = check - blockStart;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays >= 0 && diffDays <= 4; 
};

// --- COMPONENTES AUXILIARES ---
const UDRLogo = ({ className }) => {
  const [hasError, setHasError] = useState(false);
  if (hasError) {
    return <div className={`${className} bg-red-700 rounded-full flex items-center justify-center text-white font-bold text-xs`}>PUD</div>;
  }
  return (
    <img 
      src={LOGO_DRIVE_URL} 
      className={className} 
      alt="Escudo"
      style={{ objectFit: 'contain' }}
      onError={() => setHasError(true)}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  );
};

// --- APP PRINCIPAL ---
export default function App() {
  const [initStatus, setInitStatus] = useState('idle');
  const [debugLogs, setDebugLogs] = useState(["[UI] Iniciando componente App..."]);
  const [initError, setInitError] = useState(null);

  const [user, setUser] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // UI State
  const [selectedBlock, setSelectedBlock] = useState(null); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [view, setView] = useState('landing'); 
  
  // Admin
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState({ id: '', pass: '' });

  // Form
  const [formData, setFormData] = useState({ firstName: '', lastName: '', isMember: false, memberNumber: '' });

  const addLog = (msg) => {
    console.log(`[App Log] ${msg}`);
    setDebugLogs(prev => [...prev, msg]);
  };

  // 1. EFECTO DE INICIALIZACIÓN
  useEffect(() => {
    if (initStatus !== 'idle') return;

    const runInit = async () => {
      setInitStatus('loading');
      addLog("1. Ejecutando runInit()...");

      try {
        if (!getApps().length) {
          app = initializeApp(firebaseConfig);
          addLog("2. Firebase inicializado (Nueva instancia)");
        } else {
          app = getApp();
          addLog("2. Firebase recuperado (Instancia existente)");
        }

        auth = getAuth(app);
        db = getFirestore(app);
        addLog("3. Servicios Auth y Firestore listos");

        // Auth Listener
        onAuthStateChanged(auth, (u) => {
          if (u) {
            addLog(`4. Usuario autenticado: ${u.uid.substring(0,5)}...`);
            setUser(u);
            setInitStatus('success');
          } else {
            addLog("4. Sin usuario, intentando anónimo...");
            signInAnonymously(auth).catch(e => {
               throw new Error(`Login Anónimo Falló: ${e.message}`);
            });
          }
        });

      } catch (e) {
        setInitError(e.message);
        setInitStatus('error');
        addLog(`ERROR FATAL: ${e.message}`);
      }
    };

    runInit();
  }, [initStatus]);

  // 2. DATA FETCHING
  useEffect(() => {
    if (initStatus !== 'success' || !user) return;
    
    addLog("5. Conectando a Base de Datos...");
    
    // Escuchar reservas
    const unsubRes = onSnapshot(
        query(collection(db, 'artifacts', appId, 'public', 'data', 'reservations')), 
        (snap) => {
            const data = snap.docs.map(d => ({id: d.id, ...d.data()}));
            setReservations(data);
        },
        (err) => addLog(`Error BD Reservas: ${err.message}`)
    );

    // Escuchar admins
    const unsubAdmins = onSnapshot(
        query(collection(db, 'artifacts', appId, 'public', 'data', 'admins')),
        (snap) => {
            const data = snap.docs.map(d => ({id: d.id, ...d.data()}));
            setAdmins(data);
        },
        (err) => addLog(`Error BD Admins: ${err.message}`)
    );

    return () => { unsubRes(); unsubAdmins(); };
  }, [initStatus, user]);


  // --- PANTALLA DE CARGA / ERROR ---
  if (initStatus !== 'success') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-mono text-xs">
         <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
            {initStatus === 'error' ? (
                <div className="text-red-600 mb-4">
                    <AlertTriangle size={40} className="mx-auto mb-2"/>
                    <h2 className="text-xl font-bold text-center">Error Crítico</h2>
                    <p className="mt-2 text-center border p-2 rounded bg-red-50">{initError}</p>
                </div>
            ) : (
                <div className="text-center mb-4">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                    <h2 className="text-lg font-bold text-gray-700">Iniciando App...</h2>
                </div>
            )}

            <div className="bg-gray-900 text-green-400 p-3 rounded h-48 overflow-y-auto text-[10px] leading-tight shadow-inner">
                {debugLogs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
            </div>

            {initStatus === 'error' && (
                <button onClick={() => window.location.reload()} className="w-full mt-4 bg-red-600 text-white py-2 rounded font-bold">
                    Reintentar
                </button>
            )}
         </div>
      </div>
    );
  }

  // --- UI PRINCIPAL ---
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startingDay = firstDay === 0 ? 6 : firstDay - 1; // Lunes=0
    
    const days = [];
    for (let i = 0; i < startingDay; i++) days.push(<div key={`e-${i}`} className="h-16 bg-gray-50 rounded-lg"></div>);
    
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const blockStart = getBlockStart(date);
        const blockId = formatDateId(blockStart);
        const res = reservations.find(r => r.id === blockId);
        const inBlock = isDateInBlock(date, blockId);
        
        let color = 'bg-white border-gray-200';
        if (inBlock) {
             if (res) color = res.status === 'confirmed' ? 'bg-red-100 border-red-300' : 'bg-orange-100 border-orange-300';
             else color = 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer';
        }

        days.push(
            <div key={d} onClick={() => { if(inBlock) { setSelectedBlock({id: blockId, date: blockStart, reservation: res}); setIsModalOpen(true); } }} 
                 className={`h-16 border rounded-lg p-1 text-xs relative flex flex-col items-center justify-center transition-all ${color}`}>
                <span className="font-bold">{d}</span>
                {res && inBlock && <span className="text-[8px] uppercase font-bold">{res.status}</span>}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-7 gap-1 mt-4">
            {['L','M','X','J','V','S','D'].map(d => <div key={d} className="text-center font-bold text-gray-400 text-xs">{d}</div>)}
            {days}
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto shadow-2xl bg-white min-h-[100vh]">
        {/* HEADER */}
        {view !== 'landing' && (
            <header className="p-4 bg-white shadow-sm flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('calendar')}>
                    <UDRLogo className="w-8 h-8"/>
                    <div>
                        <h1 className="font-bold text-sm text-red-900 leading-none">PEÑA UNIÓN</h1>
                        <p className="text-[8px] text-yellow-600 font-bold tracking-widest">DEPORTIVA ROTEÑA</p>
                    </div>
                </div>
                <button onClick={() => setIsMenuOpen(true)} className="p-2 bg-gray-100 rounded-full"><Menu size={20}/></button>
            </header>
        )}

        {/* CONTENIDO */}
        <main className="p-4">
            {view === 'landing' && (
                <div className="flex flex-col items-center justify-center h-[80vh] space-y-6">
                    <UDRLogo className="w-32 h-32"/>
                    <div className="text-center">
                        <h1 className="text-3xl font-black text-red-900">P.U.D. Roteña</h1>
                        <p className="text-sm text-gray-500 font-medium">Gestión de Reservas</p>
                    </div>
                    <div className="w-full space-y-3">
                        <button onClick={() => setView('calendar')} className="w-full bg-white border-2 border-red-50 p-4 rounded-xl flex items-center gap-4 shadow-sm active:scale-95 transition-transform">
                            <div className="bg-red-100 p-3 rounded-full text-red-600"><User/></div>
                            <div className="text-left"><h3 className="font-bold">Soy Socio</h3><p className="text-xs text-gray-500">Reservar caseta</p></div>
                        </button>
                        <button onClick={() => setView('adminLogin')} className="w-full bg-gray-900 text-white p-4 rounded-xl flex items-center gap-4 shadow-lg active:scale-95 transition-transform">
                            <div className="bg-gray-700 p-3 rounded-full"><Lock/></div>
                            <div className="text-left"><h3 className="font-bold">Administrador</h3><p className="text-xs text-gray-400">Junta Directiva</p></div>
                        </button>
                    </div>
                </div>
            )}

            {view === 'calendar' && (
                <div>
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl mb-4">
                        <button onClick={() => {const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d)}}><ChevronRight className="rotate-180"/></button>
                        <h2 className="font-bold uppercase">{currentDate.toLocaleDateString('es-ES', {month: 'long', year: 'numeric'})}</h2>
                        <button onClick={() => {const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d)}}><ChevronRight/></button>
                    </div>
                    {renderCalendar()}
                    <div className="mt-4 bg-blue-50 p-3 rounded-lg text-xs text-blue-800 flex gap-2">
                        <Info size={16} className="shrink-0"/>
                        <p>Las reservas son por fin de semana completo (Jueves a Lunes).</p>
                    </div>
                </div>
            )}
            
            {view === 'adminLogin' && (
                 <div className="mt-10">
                     <h2 className="text-2xl font-bold text-center mb-6">Acceso Directiva</h2>
                     <div className="space-y-4">
                        <input type="text" placeholder="Usuario" className="w-full p-3 border rounded-lg" value={adminUser.id} onChange={e => setAdminUser({...adminUser, id: e.target.value})} />
                        <input type="password" placeholder="Contraseña" className="w-full p-3 border rounded-lg" value={adminUser.pass} onChange={e => setAdminUser({...adminUser, pass: e.target.value})} />
                        <button onClick={() => {
                            if ((adminUser.id === MASTER_ADMIN_ID && adminUser.pass === MASTER_ADMIN_PASS) || admins.find(a => a.memberId === adminUser.id && a.password === adminUser.pass)) {
                                setIsAdminLoggedIn(true);
                                setView('adminPanel');
                            } else {
                                alert("Credenciales incorrectas");
                            }
                        }} className="w-full bg-black text-white p-3 rounded-lg font-bold">Entrar</button>
                        <button onClick={() => setView('landing')} className="w-full text-gray-500 text-sm">Cancelar</button>
                     </div>
                 </div>
            )}
            
            {view === 'adminPanel' && (
                <div className="text-center mt-10">
                    <h2 className="text-xl font-bold mb-4">Panel de Administración</h2>
                    <p className="mb-4">Bienvenido. Usa la vista de calendario para gestionar reservas.</p>
                    <button onClick={() => setView('calendar')} className="bg-red-700 text-white px-6 py-2 rounded-lg font-bold">Ir al Calendario</button>
                    <button onClick={() => {setIsAdminLoggedIn(false); setView('landing');}} className="block mx-auto mt-6 text-red-600 text-sm">Cerrar Sesión</button>
                </div>
            )}
        </main>

        {/* MODAL RESERVA INTEGRADO */}
        {isModalOpen && selectedBlock && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden animate-slide-up">
                    <div className="bg-red-700 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold">Reserva: {formatDateId(selectedBlock.date)}</h3>
                        <button onClick={() => setIsModalOpen(false)}><X/></button>
                    </div>
                    <div className="p-4 space-y-4">
                        
                        {selectedBlock.reservation ? (
                            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                <p><strong>Titular:</strong> {selectedBlock.reservation.firstName} {selectedBlock.reservation.lastName}</p>
                                <p><strong>Estado:</strong> <span className={`font-bold ${selectedBlock.reservation.status === 'confirmed' ? 'text-green-600' : 'text-orange-500'}`}>{selectedBlock.reservation.status.toUpperCase()}</span></p>
                                <p><strong>Precio:</strong> {selectedBlock.reservation.price}€</p>
                                
                                {isAdminLoggedIn && (
                                    <div className="pt-4 flex gap-2 border-t mt-2">
                                        {selectedBlock.reservation.status === 'pending' && <button onClick={async () => {
                                            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.id), {status: 'confirmed'});
                                            setIsModalOpen(false);
                                        }} className="flex-1 bg-green-600 text-white p-2 rounded text-xs font-bold">Confirmar Pago</button>}
                                        <button onClick={async () => {
                                            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.id));
                                            setIsModalOpen(false);
                                        }} className="flex-1 bg-red-100 text-red-600 p-2 rounded text-xs font-bold">Eliminar</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <input type="text" placeholder="Nombre" className="w-full border p-2 rounded" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                                <input type="text" placeholder="Apellidos" className="w-full border p-2 rounded" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                                <label className="flex items-center gap-2 bg-gray-50 p-2 rounded"><input type="checkbox" checked={formData.isMember} onChange={e => setFormData({...formData, isMember: e.target.checked})}/> Es Socio</label>
                                <div className="text-right font-bold text-lg text-red-700">{formData.isMember ? '100€' : '300€'}</div>
                                <button onClick={async () => {
                                    if(!formData.firstName || !formData.lastName) return alert("Rellena los datos");
                                    const price = formData.isMember ? 100 : 300;
                                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.id), {
                                        startDate: selectedBlock.id, status: 'pending', firstName: formData.firstName, lastName: formData.lastName, isMember: formData.isMember, price, createdAt: serverTimestamp()
                                    });
                                    setIsModalOpen(false);
                                }} className="w-full bg-red-700 text-white py-3 rounded-lg font-bold">Confirmar Reserva</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* MENÚ LATERAL */}
        {isMenuOpen && (
            <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setIsMenuOpen(false)}>
                <div className="bg-white h-full w-64 absolute right-0 p-6 space-y-4" onClick={e => e.stopPropagation()}>
                    <h2 className="font-bold text-xl border-b pb-4">Menú</h2>
                    <button onClick={() => {setView('calendar'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium">Calendario</button>
                    {isAdminLoggedIn && <button onClick={() => {setView('adminPanel'); setIsMenuOpen(false)}} className="block w-full text-left py-2 font-medium text-red-700">Admin</button>}
                    <button onClick={() => {setIsMenuOpen(false); setIsAdminLoggedIn(false); setView('landing');}} className="block w-full text-left py-2 text-gray-400 text-sm mt-10">Salir</button>
                </div>
            </div>
        )}
    </div>
  );
}
