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
  XCircle
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
// Se intenta conectar con la configuración proporcionada por el entorno.
// Si falla, la app carga en modo visual pero sin guardar datos reales.
let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  
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

// Enlace directo a la imagen en Google Drive (Formato de visualización)
const LOGO_DRIVE_URL = "https://drive.google.com/uc?export=view&id=1hdKsxPzNRXFE-P5vtvokNBPlwVPI4GH5";

// --- UTILIDADES Y AYUDANTES ---

// Calcula el jueves de inicio para un bloque de reserva
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

// Formato de ID para base de datos (YYYY-MM-DD)
const formatDateId = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Formato legible para el usuario
const formatDisplayDate = (date) => {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

// Comprueba si una fecha cae dentro de un bloque reservado
const isDateInBlock = (checkDate, blockStartDateStr) => {
  if (!blockStartDateStr) return false;
  const blockStart = new Date(blockStartDateStr);
  const check = new Date(checkDate);
  check.setHours(0,0,0,0);
  const diffTime = check - blockStart;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays >= 0 && diffDays <= 4; // 0=Jue, 1=Vie, 2=Sab, 3=Dom, 4=Lun
};

// --- COMPONENTE DE LOGO ROBUSTO ---
// Intenta cargar la imagen de Drive. Si falla, dibuja un escudo CSS como respaldo.
const UDRLogo = ({ className }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    // Escudo CSS de respaldo (Verde, Blanco, Rojo con banda Amarilla)
    return (
      <div className={`${className} flex items-center justify-center`} style={{position: 'relative', minWidth: '40px', minHeight: '40px'}}>
        <div style={{
          width: '100%', height: '100%', 
          background: 'linear-gradient(135deg, #ffffff 0%, #ffffff 50%, #d32f2f 50%, #d32f2f 100%)',
          clipPath: 'polygon(50% 0, 100% 0, 100% 70%, 50% 100%, 0 70%, 0 0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid black',
          position: 'relative'
        }}>
          {/* Banda amarilla */}
          <div style={{
            position: 'absolute', width: '120%', height: '25%', background: '#FFD700',
            top: '45%', left: '-10%', transform: 'rotate(-20deg)',
            borderTop: '1px solid black', borderBottom: '1px solid black',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
          }}>
             <span style={{fontSize: '10px', fontWeight: '900', color: 'black'}}>P.U.D.R.</span>
          </div>
          {/* Verde arriba izquierda */}
          <div style={{position: 'absolute', top: 0, left: 0, width: '50%', height: '50%', background: '#008000', opacity: 0.3}}></div>
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

// --- MODAL DE RESERVA ---

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
  
  // Cálculo de días restantes para pago
  let daysLeft = 0;
  if (res && res.createdAt) {
    const diff = (new Date() - res.createdAt.toDate()) / (1000 * 60 * 60 * 24);
    daysLeft = Math.max(0, 5 - Math.ceil(diff));
  }

  const blockEndDate = new Date(selectedBlock.date);
  blockEndDate.setDate(blockEndDate.getDate() + 4); 

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:rounded-xl shadow-2xl sm:max-w-md overflow-hidden max-h-[90vh] flex flex-col rounded-t-2xl animate-slide-up sm:animate-none">
        <div className="bg-red-900 p-4 flex justify-between items-center text-white shrink-0">
          <h3 className="font-bold text-lg">
            {res ? 'Detalle Reserva' : 'Nueva Reserva'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={24} /></button>
        </div>
        
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="text-center mb-2">
            <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Fin de Semana</p>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {formatDisplayDate(selectedBlock.date)} - {formatDisplayDate(blockEndDate)}
            </p>
          </div>

          {!res && (
            <form onSubmit={onReservation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input 
                  required 
                  type="text" 
                  className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  placeholder="Nombre del titular"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                <input 
                  required 
                  type="text" 
                  className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  value={formData.lastName}
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                  placeholder="Apellidos"
                />
              </div>
              
              <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-lg border border-gray-100 active:bg-gray-100 transition-colors">
                <input 
                  type="checkbox" 
                  id="isMember"
                  className="w-6 h-6 text-red-600 rounded focus:ring-red-500 border-gray-300"
                  checked={formData.isMember}
                  onChange={e => setFormData({...formData, isMember: e.target.checked})}
                />
                <label htmlFor="isMember" className="text-gray-800 font-medium flex-1">¿Es Socio?</label>
              </div>

              {formData.isMember && (
                 <div className="animate-fade-in">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Número de Socio (Opcional)</label>
                   <input 
                     type="number" 
                     className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-red-500 outline-none transition-all"
                     value={formData.memberNumber}
                     onChange={e => setFormData({...formData, memberNumber: e.target.value})}
                     placeholder="Ej: 1234"
                   />
                 </div>
              )}

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-900 rounded-r-lg shadow-sm">
                <p className="font-bold flex items-center gap-2 text-lg"><Euro size={20}/> {formData.isMember ? '100,00€' : '300,00€'}</p>
                <p className="mt-1 opacity-90">Si no se realiza el pago en 5 días, la fecha quedará libre automáticamente.</p>
              </div>

              <button 
                type="submit" 
                className="w-full bg-red-700 hover:bg-red-800 active:scale-[0.98] text-white font-bold py-4 rounded-xl shadow-lg transition-all text-lg mt-2"
              >
                Confirmar Reserva
              </button>
            </form>
          )}

          {res && (
            <div className="space-y-4">
               <div className={`p-4 rounded-xl border-l-4 shadow-sm ${res.status === 'confirmed' ? 'bg-green-50 border-green-500' : 'bg-orange-50 border-orange-500'}`}>
                  <div className="flex items-center gap-2 mb-2">
                      {res.status === 'confirmed' ? <Check className="text-green-600" size={24}/> : <Clock className="text-orange-600" size={24}/>}
                      <span className="font-bold uppercase text-base">{res.status === 'confirmed' ? 'Pagado / Confirmado' : 'Pendiente de Pago'}</span>
                  </div>
                  {res.status === 'pending' && (
                      <p className="text-sm text-orange-800 font-medium pl-8">
                         Caduca en: <span className="font-bold text-lg">{daysLeft}</span> días
                      </p>
                  )}
               </div>

               <div className="bg-gray-50 p-5 rounded-xl space-y-3 border border-gray-100">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">Titular</span>
                    <span className="font-semibold text-right">{res.firstName} {res.lastName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">Tipo</span>
                    <span className="font-semibold text-right">{res.isMember ? `Socio ${res.memberNumber ? `(#${res.memberNumber})` : ''}` : 'No Socio'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Importe</span>
                    <span className="font-bold text-red-700 text-lg text-right">{res.price.toFixed(2)}€</span>
                  </div>
               </div>

               {isAdminLoggedIn && (
                  <div className="space-y-3 pt-4 border-t">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center mb-2">Zona Admin</p>
                      
                      {res.status === 'pending' && (
                          <button 
                              onClick={onConfirmPayment}
                              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg flex justify-center items-center gap-2 font-semibold shadow-md active:scale-95 transition-transform"
                          >
                              <Check size={20}/> Confirmar Pago
                          </button>
                      )}

                      <button 
                          onClick={onCancelReservation}
                          className="w-full bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 py-3 rounded-lg flex justify-center items-center gap-2 font-semibold active:scale-95 transition-transform"
                      >
                        <Trash2 size={20}/> Cancelar Reserva
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

// --- PANEL DE ADMINISTRACIÓN ---

const AdminPanel = ({ 
  admins, 
  onExit, 
  onAddAdmin, 
  onDeleteAdmin,
  onUpdateAdminPass,
  newAdminData, 
  setNewAdminData,
  currentAdminId
}) => {
  const isMaster = currentAdminId === MASTER_ADMIN_ID;
  const [editingId, setEditingId] = useState(null);
  const [editPassValue, setEditPassValue] = useState("");

  const startEditing = (admin) => {
    setEditingId(admin.id);
    setEditPassValue(admin.password);
  };

  const saveEditing = (adminId) => {
    onUpdateAdminPass(adminId, editPassValue);
    setEditingId(null);
    setEditPassValue("");
  };

  return (
    <div className="p-4 space-y-6 pb-20">
       <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm sticky top-20 z-10">
         <h2 className="text-lg font-bold text-gray-800">Panel Admin</h2>
         <button onClick={onExit} className="text-red-700 font-medium text-sm flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-full"><LogOut size={14}/> Salir</button>
       </div>
       
       <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-5 text-red-900 bg-red-50 p-3 rounded-lg">
             <div className="bg-white p-2 rounded-full shadow-sm"><User size={20}/></div>
             <div>
                <span className="text-xs text-red-600 font-bold uppercase block">Sesión Actual</span>
                <span className="font-bold">{currentAdminId === MASTER_ADMIN_ID ? 'Admin Principal (123)' : `Colaborador (${currentAdminId})`}</span>
             </div>
          </div>

          {isMaster ? (
             <>
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide border-b pb-2">Gestión de Administradores</h3>
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold uppercase">Añadir nuevo colaborador</p>
                  <div className="flex flex-col gap-3">
                    <input 
                        type="number" 
                        placeholder="Nº Socio (Login)" 
                        className="border border-gray-300 p-3 rounded-lg text-base outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        value={newAdminData.id}
                        onChange={(e) => setNewAdminData({...newAdminData, id: e.target.value})}
                    />
                    <input 
                        type="text" 
                        placeholder="Contraseña" 
                        className="border border-gray-300 p-3 rounded-lg text-base outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        value={newAdminData.pass}
                        onChange={(e) => setNewAdminData({...newAdminData, pass: e.target.value})}
                    />
                  </div>
                  <button 
                    onClick={onAddAdmin} 
                    className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-black font-bold text-sm flex justify-center items-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    <User size={18}/> Crear Administrador
                  </button>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-bold text-gray-700 mb-3">Listado de Administradores</p>
                  <ul className="space-y-3">
                      <li className="bg-gradient-to-r from-red-50 to-white border border-red-100 p-3 rounded-lg flex justify-between items-center shadow-sm">
                        <span className="font-bold text-red-900 text-sm flex items-center gap-2"><Lock size={14}/> Master (123)</span>
                        <span className="text-[10px] uppercase font-bold bg-red-200 text-red-900 px-2 py-1 rounded-full">Principal</span>
                      </li>
                      {admins.map(a => (
                          <li key={a.id} className="bg-white border border-gray-200 p-3 rounded-lg flex flex-col gap-3 shadow-sm">
                            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                <span className="font-mono font-bold text-sm flex items-center gap-2 text-gray-700">
                                  <User size={16} className="text-gray-400"/> Socio {a.memberId}
                                </span>
                                <div className="flex gap-1">
                                    {editingId === a.id ? (
                                      <>
                                        <button 
                                            onClick={() => saveEditing(a.id)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg bg-green-100 transition-colors"
                                        >
                                            <Save size={18}/>
                                        </button>
                                        <button 
                                            onClick={() => setEditingId(null)}
                                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <XCircle size={18}/>
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button 
                                            onClick={() => startEditing(a)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Key size={18}/>
                                        </button>
                                        <button 
                                            onClick={() => onDeleteAdmin(a.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
                                      </>
                                    )}
                                </div>
                            </div>
                            
                            {editingId === a.id ? (
                              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                                <span className="text-xs text-gray-500 font-bold whitespace-nowrap">Nueva pass:</span>
                                <input 
                                  type="text" 
                                  value={editPassValue} 
                                  onChange={(e) => setEditPassValue(e.target.value)}
                                  className="border rounded px-2 py-1 text-sm w-full outline-none focus:border-blue-500"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 font-mono pl-6">Pass: {a.password}</div>
                            )}
                          </li>
                      ))}
                      {admins.length === 0 && <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">No hay colaboradores añadidos.</p>}
                  </ul>
                </div>
             </>
          ) : (
             <div className="p-6 bg-gray-50 rounded-xl text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                <Shield size={32} className="text-gray-300"/>
                <p>Tu nivel de acceso no permite gestionar usuarios.</p>
             </div>
          )}
       </div>

       <div className="bg-blue-50 p-5 rounded-xl text-sm text-blue-900 border border-blue-100">
          <p className="font-bold flex items-center gap-2 mb-2"><Info size={18}/> Acciones Rápidas</p>
          <ul className="space-y-2 pl-2">
            <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></div> <span>Pulsar en una reserva <strong>Naranja</strong> para confirmar pago.</span></li>
            <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></div> <span>Pulsar en cualquier reserva para <strong>cancelarla</strong>.</span></li>
          </ul>
       </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL (APP) ---

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
  const [slideDirection, setSlideDirection] = useState(''); // 'left' or 'right'
  
  // Admin State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState(''); // Stores WHO is logged in
  const [adminUser, setAdminUser] = useState({ id: '', pass: '' });
  const [newAdminData, setNewAdminData] = useState({ id: '', pass: '' });

  // Swipe handlers
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const changeMonth = (direction) => {
      setSlideDirection(direction === 'next' ? 'left' : 'right');
      const newDate = new Date(currentDate);
      if (direction === 'next') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else {
        newDate.setMonth(newDate.getMonth() - 1);
      }
      setTimeout(() => setCurrentDate(newDate), 0);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      changeMonth('next');
    }
    if (isRightSwipe) {
      changeMonth('prev');
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    isMember: false,
    memberNumber: ''
  });

  // --- AUTH & DATA SYNC ---
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
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    
    const qRes = query(collection(db, 'artifacts', appId, 'public', 'data', 'reservations'));
    const unsubRes = onSnapshot(qRes, (snapshot) => {
      const resData = [];
      const now = new Date();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let isExpired = false;
        if (data.status === 'pending' && data.createdAt) {
          const created = data.createdAt.toDate();
          const diffDays = (now - created) / (1000 * 60 * 60 * 24);
          if (diffDays > 5) {
            isExpired = true;
            deleteDoc(docSnap.ref);
          }
        }
        if (!isExpired) resData.push({ id: docSnap.id, ...data });
      });
      setReservations(resData);
    });

    const qAdmins = query(collection(db, 'artifacts', appId, 'public', 'data', 'admins'));
    const unsubAdmins = onSnapshot(qAdmins, (snapshot) => {
      const adData = [];
      snapshot.forEach(doc => adData.push({ id: doc.id, ...doc.data() }));
      setAdmins(adData);
    });

    return () => {
      unsubRes();
      unsubAdmins();
    };
  }, [user]);

  // --- HANDLERS ---

  const handleDayClick = (day) => {
    const blockStart = getBlockStart(day);
    const blockId = formatDateId(blockStart);
    const existing = reservations.find(r => r.id === blockId);
    
    setSelectedBlock({
      id: blockId,
      date: blockStart,
      reservation: existing || null
    });
    setIsModalOpen(true);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (adminUser.id === MASTER_ADMIN_ID && adminUser.pass === MASTER_ADMIN_PASS) {
      setIsAdminLoggedIn(true);
      setCurrentAdminId(MASTER_ADMIN_ID);
      setView('adminPanel');
      return;
    }
    const validSubAdmin = admins.find(a => a.memberId === adminUser.id && a.password === adminUser.pass);
    if (validSubAdmin) {
       setIsAdminLoggedIn(true);
       setCurrentAdminId(validSubAdmin.memberId);
       setView('adminPanel');
       return;
    }
    console.log('Credenciales incorrectas');
  };

  const handleAddAdmin = async () => {
    if (!newAdminData.id || !newAdminData.pass) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admins', newAdminData.id), {
        memberId: newAdminData.id,
        password: newAdminData.pass,
        addedBy: currentAdminId,
        createdAt: serverTimestamp()
      });
      setNewAdminData({ id: '', pass: '' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAdmin = async (id) => {
      try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admins', id));
      } catch(e) { console.error(e); }
  };

  const handleUpdateAdminPass = async (id, newPass) => {
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admins', id), {
              password: newPass
          });
      } catch(e) { console.error(e); }
  };

  const handleReservation = async (e) => {
    e.preventDefault();
    if (!selectedBlock) return;
    const price = formData.isMember ? 100 : 300;
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.id), {
        startDate: selectedBlock.id,
        status: 'pending', 
        firstName: formData.firstName,
        lastName: formData.lastName,
        isMember: formData.isMember,
        memberNumber: formData.memberNumber || null,
        price: price,
        createdAt: serverTimestamp()
      });
      
      setIsModalOpen(false);
      setFormData({ firstName: '', lastName: '', isMember: false, memberNumber: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedBlock?.reservation) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.id), {
        status: 'confirmed'
      });
      setIsModalOpen(false);
    } catch (e) {}
  };

  const handleCancelReservation = async () => {
    if (!selectedBlock?.reservation) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', selectedBlock.id));
      setIsModalOpen(false);
    } catch (e) { console.error(e); }
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    setCurrentAdminId('');
    setIsMenuOpen(false);
    setAdminUser({id:'', pass:''});
    setView('landing');
  };

  if (!app) return <div className="p-10 text-center text-gray-500 animate-pulse">Iniciando P.U.D.R...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-10">
      <style>{`
        @keyframes slideInRight { from { transform: translateX(50%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInLeft { from { transform: translateX(-50%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in-right { animation: slideInRight 0.3s ease-out forwards; }
        .animate-slide-in-left { animation: slideInLeft 0.3s ease-out forwards; }
      `}</style>
      
      {view !== 'landing' && (
        <header className="bg-white text-gray-800 p-4 shadow-sm sticky top-0 z-40 border-b border-gray-200">
          <div className="flex justify-between items-center max-w-4xl mx-auto">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('calendar')}>
               <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-0.5 overflow-hidden shadow-md border border-gray-100">
                  <UDRLogo className="w-full h-full object-contain" />
               </div>
               <div className="leading-none">
                 <h1 className="font-extrabold text-base text-red-900">Peña Unión</h1>
                 <h2 className="text-[10px] text-yellow-600 font-bold tracking-widest uppercase">Deportiva Roteña</h2>
               </div>
            </div>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
              <Menu size={20} className="text-gray-700"/>
            </button>
          </div>
        </header>
      )}

      {isMenuOpen && view !== 'landing' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsMenuOpen(false)}>
            <div className="absolute right-0 top-0 h-full w-[80%] max-w-sm bg-white shadow-2xl p-6 flex flex-col animate-slide-in-right" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-8 border-b pb-4">
                    <span className="font-bold text-lg text-gray-800">Menú</span>
                    <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
                </div>
                <nav className="space-y-3 flex-1">
                    <button onClick={() => {setView('calendar'); setIsMenuOpen(false);}} className="w-full text-left p-4 hover:bg-red-50 rounded-xl flex items-center gap-4 font-bold text-gray-700 transition-colors">
                        <CalendarIcon size={22} className="text-red-800"/> Calendario
                    </button>
                    <button onClick={() => {setView('rules'); setIsMenuOpen(false);}} className="w-full text-left p-4 hover:bg-red-50 rounded-xl flex items-center gap-4 font-bold text-gray-700 transition-colors">
                        <Shield size={22} className="text-red-800"/> Normativa
                    </button>
                    {isAdminLoggedIn && (
                        <button onClick={() => {setView('adminPanel'); setIsMenuOpen(false);}} className="w-full text-left p-4 bg-red-900 text-white rounded-xl flex items-center gap-4 font-bold shadow-md mt-4">
                            <Users size={22}/> Panel Admin
                        </button>
                    )}
                </nav>
                <div className="pt-6 border-t">
                    <button onClick={handleLogout} className="w-full p-4 text-red-600 bg-red-50 rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-red-100 transition-colors">
                        <LogOut size={18}/> Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto">
        
        {view === 'landing' && (
          <div className="flex flex-col items-center justify-center min-h-[90vh] px-6 animate-fade-in pb-10">
            <div className="mb-10 text-center flex flex-col items-center">
              <div className="w-32 h-32 bg-white rounded-b-[2rem] rounded-t-xl flex items-center justify-center shadow-xl overflow-hidden mb-6 p-2 ring-4 ring-yellow-400/20">
                  <UDRLogo className="w-full h-full object-contain" />
              </div>
              <h1 className="text-4xl font-black text-red-900 uppercase tracking-tight drop-shadow-sm">Peña Unión</h1>
              <h2 className="text-sm text-yellow-600 font-bold tracking-[0.3em] mt-1 border-t border-b border-yellow-200 py-1 px-4">DEPORTIVA ROTEÑA</h2>
            </div>

            <div className="w-full max-w-sm space-y-4">
              <button 
                onClick={() => setView('calendar')}
                className="w-full bg-white border border-red-100 hover:border-red-500 hover:bg-red-50 active:bg-red-100 active:scale-[0.98] transition-all p-6 rounded-2xl shadow-lg flex items-center justify-between group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
                <div className="flex items-center gap-5 relative z-10">
                  <div className="p-4 bg-red-100 rounded-2xl text-red-700 group-hover:bg-red-600 group-hover:text-white transition-colors shadow-sm">
                    <User size={28} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-xl text-gray-800">Soy Socio</h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Reservar y ver calendario</p>
                  </div>
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-red-500 relative z-10" />
              </button>

              <button 
                onClick={() => setView('adminLogin')}
                className="w-full bg-gray-900 text-white p-6 rounded-2xl shadow-xl flex items-center justify-between group active:scale-[0.98] transition-all border border-gray-800"
              >
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-gray-800 rounded-2xl text-gray-300 group-hover:text-white transition-colors border border-gray-700">
                    <Lock size={28} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-xl">Administrador</h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">Acceso Junta Directiva</p>
                  </div>
                </div>
                <ChevronRight className="text-gray-600 group-hover:text-white" />
              </button>
            </div>
            
            <div className="mt-16 text-center opacity-40">
              <p className="text-[10px] font-bold tracking-widest uppercase">Aplicación Oficial</p>
              <p className="text-[10px]">© 2025 P.U.D. Roteña</p>
            </div>
          </div>
        )}

        {view === 'calendar' && (
          <div className="p-4 space-y-6 animate-fade-in pb-20">
             <div className="flex justify-between items-center mb-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                <button onClick={() => changeMonth('prev')} className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"><ChevronRight className="rotate-180" size={20}/></button>
                <h2 className="text-lg font-black text-gray-800 uppercase tracking-wide">
                    {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => changeMonth('next')} className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"><ChevronRight size={20}/></button>
             </div>

             {renderCalendar()}

             <div className="grid grid-cols-3 gap-3 text-xs text-center mt-6">
                <div className="flex flex-col items-center gap-2 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-4 h-4 rounded-full bg-green-500 shadow-sm ring-2 ring-green-100"></div>
                    <span className="font-bold text-gray-600">Libre</span>
                </div>
                <div className="flex flex-col items-center gap-2 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-4 h-4 rounded-full bg-orange-400 shadow-sm ring-2 ring-orange-100"></div>
                    <span className="font-bold text-gray-600">Pendiente</span>
                </div>
                <div className="flex flex-col items-center gap-2 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-4 h-4 rounded-full bg-red-500 shadow-sm ring-2 ring-red-100"></div>
                    <span className="font-bold text-gray-600">Pagado</span>
                </div>
             </div>
             
             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-900 flex items-start gap-3 mt-4">
                <Info className="shrink-0 text-blue-600 mt-0.5" size={18}/>
                <p className="leading-relaxed">Las reservas se realizan por <strong>Fin de Semana completo</strong>. Toca un día <strong className="text-green-600">VERDE</strong> para empezar.</p>
             </div>
          </div>
        )}

        {view === 'rules' && (
          <div className="p-5 pb-20 space-y-6 text-gray-700 text-sm leading-relaxed overflow-y-auto h-full">
              <div className="flex items-center justify-between border-b pb-4 sticky top-0 bg-gray-50 z-10">
                <h2 className="text-xl font-bold text-red-900">Normativa</h2>
                <button onClick={() => setView('calendar')} className="bg-white border border-gray-200 p-2 rounded-full shadow-sm text-gray-600"><X size={20}/></button>
              </div>
              
              <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2"><User size={18} className="text-red-700"/> 1. Uso exclusivo</h3>
                  <p>El socio podrá solicitar la caseta para actos personales, de hijos o nietos. El responsable siempre será el SOCIO.</p>
              </section>

              <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2"><Euro size={18} className="text-red-700"/> 2. Pagos y Reservas</h3>
                  <p className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-900 text-xs mb-3">
                      <AlertTriangle size={14} className="inline mr-1"/> La reserva no es efectiva hasta el ingreso. <strong>Plazo máximo de 5 días</strong>.
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-gray-50 p-2 rounded-lg border">
                        <span className="block text-xs text-gray-500">Socio</span>
                        <span className="font-bold text-lg">100€</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg border">
                        <span className="block text-xs text-gray-500">No Socio</span>
                        <span className="font-bold text-lg">300€</span>
                    </div>
                  </div>
              </section>

              <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2"><XCircle size={18} className="text-red-700"/> 3. Cancelaciones</h3>
                  <ul className="space-y-2 text-xs">
                      <li className="flex gap-2"><span className="text-red-500">•</span> Aviso con 10 días tras alquiler: Devolución posible.</li>
                      <li className="flex gap-2"><span className="text-red-500">•</span> Largo plazo ({'>'}3 meses): Aviso con 1 mes de antelación.</li>
                      <li className="flex gap-2"><span className="text-red-500">•</span> Fuerza mayor: Sin penalización.</li>
                  </ul>
              </section>

              <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2"><Key size={18} className="text-red-700"/> 4. Llaves y Fianza</h3>
                  <p className="mb-2"><strong>Fianza:</strong> 50€ a depositar al recoger la llave.</p>
                  <div className="text-xs bg-gray-50 p-3 rounded-lg space-y-1">
                    <p><strong>Recogida:</strong> JUEVES (sin excepción).</p>
                    <p><strong>Devolución:</strong> Lunes o Martes siguiente.</p>
                    <p>Día adicional: 30€.</p>
                  </div>
              </section>

              <button onClick={() => setView('calendar')} className="w-full mt-4 py-4 bg-red-900 text-white rounded-xl font-bold shadow-lg">
                  Volver al Calendario
              </button>
          </div>
        )}

        {view === 'adminPanel' && (
          <AdminPanel 
            admins={admins} 
            onExit={() => setView('calendar')} 
            onAddAdmin={handleAddAdmin}
            onDeleteAdmin={handleDeleteAdmin}
            onUpdateAdminPass={handleUpdateAdminPass}
            newAdminData={newAdminData}
            setNewAdminData={setNewAdminData}
            currentAdminId={currentAdminId}
          />
        )}

        {view === 'adminLogin' && (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100">
                    <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg text-white">
                        <Lock size={32}/>
                    </div>
                    <h2 className="text-2xl font-black text-center text-gray-900 mb-1">Acceso Directiva</h2>
                    <p className="text-center text-gray-400 text-sm mb-8">Solo personal autorizado</p>
                    
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input 
                                type="text" 
                                placeholder="Nº Socio"
                                className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl p-4 text-base font-bold outline-none focus:border-gray-900 focus:bg-white transition-all text-center"
                                value={adminUser.id}
                                onChange={e => setAdminUser({...adminUser, id: e.target.value})}
                            />
                        </div>
                        <div>
                            <input 
                                type="password" 
                                placeholder="Contraseña"
                                className="w-full border-2 border-gray-100 bg-gray-50 rounded-xl p-4 text-base font-bold outline-none focus:border-gray-900 focus:bg-white transition-all text-center"
                                value={adminUser.pass}
                                onChange={e => setAdminUser({...adminUser, pass: e.target.value})}
                            />
                        </div>
                        <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-black text-lg shadow-lg active:scale-[0.98] transition-all mt-2">
                            Entrar
                        </button>
                    </form>
                    <button onClick={() => setView('landing')} className="w-full text-center mt-6 text-sm text-gray-400 font-bold hover:text-gray-600">Cancelar</button>
                </div>
            </div>
        )}

      </main>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        selectedBlock={selectedBlock}
        formData={formData}
        setFormData={setFormData}
        onReservation={handleReservation}
        isAdminLoggedIn={isAdminLoggedIn}
        onConfirmPayment={handleConfirmPayment}
        onCancelReservation={handleCancelReservation}
      />

    </div>
  );
}
