import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const normalizeRole = (role) => (typeof role === 'string' ? role.trim().toLowerCase() : '');

const ProtectedRoute = ({ children, roles, redirectTo = null }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-logo">⛓️</div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Check role-based access if roles are specified
    if (roles && roles.length > 0) {
        const allowedRoles = roles.map(normalizeRole);
        const userRole = normalizeRole(user?.role);

        if (!user || !allowedRoles.includes(userRole)) {
            if (redirectTo) {
                return <Navigate to={redirectTo} replace />;
            }
            return (
                <div className="access-denied">
                    <h2>Access Denied</h2>
                    <p>You don't have permission to access this page.</p>
                    <p>Required role: {roles.join(' or ')}</p>
                </div>
            );
        }
    }

    return children;
};

export default ProtectedRoute;
