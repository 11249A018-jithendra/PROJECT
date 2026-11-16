import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../utils/roleRoutes';

// `role` accepts a single role string or an array of allowed roles, e.g.
// role="warden" or role={['admin', 'warden']}.
const PrivateRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  const allowedRoles = role ? (Array.isArray(role) ? role : [role]) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // The developer may open every page of every portal.
  if (allowedRoles && !user.is_developer && !allowedRoles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return children;
};

export default PrivateRoute;
