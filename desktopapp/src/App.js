import { Routes, Route } from 'react-router-dom';
import Main from './pages/main/main';
import Button from '@mui/material/Button';
import JobsPage from './pages/jobs/jobsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Main />} />
      <Route path="/button" element={<Button variant="contained">Hello world!!</Button>} />
      <Route path="/jobs" element={<JobsPage />} /> {/* Nueva ruta */}
    </Routes>
  );
}

export default App;