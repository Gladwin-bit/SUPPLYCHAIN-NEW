// src/App.js
import React, { lazy, Suspense, useState, useRef, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, NavLink, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ThemeToggle from './components/ThemeToggle';
import { motion } from 'framer-motion';
import { SupplyChainProvider, useSupplyChainContext } from './context/SupplyChainContext';
import { ConnectButton } from './components/ConnectButton';
import ProtectedRoute from './components/ProtectedRoute';
import NextStepBanner from './components/NextStepBanner';
import BlockchainBg from './components/BlockchainBg';
import ReportsPanel from './components/ReportsPanel';
import './App.css';
import './components/NavBar.css';

const Home = lazy(() => import('./pages/Home'));
const Welcome = lazy(() => import('./pages/Welcome'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const VerifyProduct = lazy(() => import('./pages/VerifyProduct'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ManageCustody = lazy(() => import('./pages/ManageCustody'));
const RecordProcedure = lazy(() => import('./pages/RecordProcedure'));
const TraceProduct = lazy(() => import('./pages/TraceProduct'));
const UploadQR = lazy(() => import('./pages/UploadQR'));
const ConsumerView = lazy(() => import('./pages/ConsumerView'));
const BlockchainExplorer = lazy(() => import('./pages/BlockchainExplorer'));
const ChainDashboard = lazy(() => import('./pages/ChainDashboard'));
const BulkRegister = lazy(() => import('./components/BulkRegister'));
const ProductScan  = lazy(() => import('./pages/ProductScan'));
const BatchShowcase = lazy(() => import('./pages/BatchShowcase'));

const normalizeRole = (role) => (typeof role === 'string' ? role.trim().toLowerCase() : '');

/* ── Chain dropdown (merges Blockchain Explorer + Chain Dashboard) ── */
function ChainDropdown() {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const location = useLocation ? undefined : undefined; // trigger re-render on route change

    // Close on outside click
    React.useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const isActive = window.location.pathname === '/explorer' || window.location.pathname === '/chain-dashboard';

    return (
        <div className="chain-dropdown" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <button className={`nav-link chain-dropdown__trigger${isActive ? ' active' : ''}`} aria-haspopup="true" aria-expanded={open}>
                Chain
                <svg className={`chain-dropdown__chevron${open ? ' open' : ''}`} width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </button>
            {open && (
                <div className="chain-dropdown__menu" role="menu">
                    <NavLink to="/explorer" className={({ isActive }) => `chain-dropdown__item${isActive ? ' active' : ''}`} onClick={() => setOpen(false)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                        Explorer
                    </NavLink>
                    <NavLink to="/chain-dashboard" className={({ isActive }) => `chain-dropdown__item${isActive ? ' active' : ''}`} onClick={() => setOpen(false)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                        Dashboard
                    </NavLink>
                </div>
            )}
        </div>
    );
}

function Navbar() {
    const { account, connectWallet } = useSupplyChainContext();
    const { user, isAuthenticated, logout } = useAuth();
    const [scrolled, setScrolled] = React.useState(false);
    const [scrollPct, setScrollPct] = React.useState(0);

    React.useEffect(() => {
        const handler = () => {
            setScrolled(window.scrollY > 60);
            const doc = document.documentElement;
            const pct = (window.scrollY / (doc.scrollHeight - doc.clientHeight)) * 100;
            setScrollPct(Math.min(pct, 100));
        };
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    const role = normalizeRole(user?.role);

    return (
        <>
        <div className="scroll-progress-bar" style={{ width: `${scrollPct}%` }} />
        <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
            <div className="nav-brand">
                <Link to={isAuthenticated ? "/" : "/welcome"}>
                    <span className="logo-icon">⬡</span>
                    <span className="logo-text">Kasaragod Sarees</span>
                </Link>
            </div>

            {isAuthenticated && (
                <div className="nav-links">
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Home</NavLink>
                    {role === 'manufacturer' && (
                        <NavLink to="/create" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Create</NavLink>
                    )}
                    {user && role !== 'customer' && (
                        <NavLink to="/custody" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Manage</NavLink>
                    )}
                    {role === 'customer' && (
                        <NavLink to="/verify" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Verify</NavLink>
                    )}
                    <NavLink to="/trace" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Trace</NavLink>
                    <NavLink to="/batch-showcase" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Batches</NavLink>
                    <ChainDropdown />
                    <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Profile</NavLink>



                    <div className="nav-user-section">
                        {user && (
                            <div className="user-badge">
                                <span className="user-name">{user.name}</span>
                                <span className="user-role">{user.role}</span>
                            </div>
                        )}

                        {/* Bell icon — manufacturers only */}
                        {role === 'manufacturer' && <ReportsPanel />}

                        {account ? (
                            <div className="wallet-info">
                                <span className="wallet-address">{account.slice(0, 6)}...{account.slice(-4)}</span>
                            </div>
                        ) : (
                            <ConnectButton
                                onClick={connectWallet}
                                className="nav-connect"
                            />
                        )}

                        <button onClick={logout} className="btn-logout" title="Logout">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                    </div>

                    <ThemeToggle />
                </div>
            )}

            {!isAuthenticated && (
                <div className="auth-buttons">
                    <Link to="/login" className="nav-link-btn">Sign In</Link>
                    <Link to="/register" className="btn-nav-primary">Get Started</Link>
                </div>
            )}
        </nav>
        </>
    );
}

class RouteErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            const msg = this.state.error?.message || 'Unknown error';
            return (
                <div className="route-error-boundary content-container">
                    <h2 className="route-error-boundary__title">This page could not be displayed</h2>
                    <p className="route-error-boundary__msg">{msg}</p>
                    <button
                        type="button"
                        className="route-error-boundary__reload"
                        onClick={() => window.location.reload()}
                    >
                        Reload page
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function AnimatedRoutes() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    const Fallback = (
        <div className="loading-screen">
            <motion.div
                className="loading-logo"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >⬡</motion.div>
            <p>Weaving your experience...</p>
        </div>
    );

    return (
        <RouteErrorBoundary>
            <Routes location={location} key={location.pathname}>
                {/* Public routes */}
                <Route path="/welcome" element={<Suspense fallback={Fallback}><PageWrapper><Welcome /></PageWrapper></Suspense>} />
                <Route path="/login" element={<Suspense fallback={Fallback}><PageWrapper><Login /></PageWrapper></Suspense>} />
                <Route path="/register" element={<Suspense fallback={Fallback}><PageWrapper><Register /></PageWrapper></Suspense>} />
                {/* Public consumer-facing product scan & verification page — no login required */}
                <Route path="/product/:id" element={<Suspense fallback={Fallback}><PageWrapper><ProductScan /></PageWrapper></Suspense>} />

                {/* Protected routes */}
                <Route path="/" element={
                    <ProtectedRoute>
                        <Suspense fallback={Fallback}><PageWrapper><Home /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />
                <Route path="/create" element={
                    <ProtectedRoute roles={['manufacturer']}>
                        <Suspense fallback={Fallback}><PageWrapper><RecordProcedure /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />
                <Route path="/create-bulk" element={
                    <ProtectedRoute roles={['manufacturer']}>
                        <Suspense fallback={Fallback}><PageWrapper><BulkRegister /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />
                <Route path="/trace" element={
                    <ProtectedRoute>
                        <Suspense fallback={Fallback}><PageWrapper><TraceProduct /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />
                <Route path="/custody" element={
                    <ProtectedRoute roles={['manufacturer', 'distributor', 'retailer', 'intermediate']}>
                        <Suspense fallback={Fallback}><PageWrapper><ManageCustody /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />
                <Route path="/verify" element={
                    <ProtectedRoute roles={['customer']} redirectTo="/">
                        <Suspense fallback={Fallback}><PageWrapper><VerifyProduct /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />
                <Route path="/explorer" element={
                    <ProtectedRoute>
                        <Suspense fallback={Fallback}><PageWrapper><BlockchainExplorer /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />
                <Route path="/batch-showcase" element={
                    <ProtectedRoute>
                        <Suspense fallback={Fallback}><PageWrapper><BatchShowcase /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />
                <Route path="/chain-dashboard" element={
                    <ProtectedRoute>
                        <Suspense fallback={Fallback}><PageWrapper><ChainDashboard /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />
                <Route path="/profile" element={
                    <ProtectedRoute>
                        <Suspense fallback={Fallback}><PageWrapper><Profile /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />

                <Route path="/upload-qr" element={
                    <ProtectedRoute>
                        <Suspense fallback={Fallback}><PageWrapper><UploadQR /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />
                <Route path="/dashboard/:productId" element={
                    <ProtectedRoute>
                        <Suspense fallback={Fallback}><PageWrapper><ConsumerView /></PageWrapper></Suspense>
                    </ProtectedRoute>
                } />

                {/* Redirect root based on auth status */}
                <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/welcome"} replace />} />
            </Routes>
        </RouteErrorBoundary>
    );
}

function PageWrapper({ children }) {
    return (
        <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="page-wrapper"
        >
            {children}
        </motion.div>
    );
}

function App() {
    return (
        <AuthProvider>
            <SupplyChainProvider>
                <ThemeProvider>
                    <Router>
                        <div className="App">
                            <BlockchainBg />
                            <Navbar />
                            <NextStepBanner />
                            <AnimatedRoutes />

                            <ToastContainer
                                position="bottom-right"
                                autoClose={3000}
                                theme="dark"
                                toastClassName="glass-toast"
                            />
                        </div>
                    </Router>
                </ThemeProvider>
            </SupplyChainProvider>
        </AuthProvider>
    );
}

export default App;
