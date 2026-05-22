import Navbar from './Navbar.jsx';

// Standard shell used by every page that wants the top navbar. The tour
// viewer page deliberately doesn't use this — it's a full-screen pano.
export default function PageShell({ children }) {
  return (
    <div className="page">
      <Navbar />
      {children}
    </div>
  );
}
