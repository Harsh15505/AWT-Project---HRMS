import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<h1>HRMS — App is running</h1>} />
      </Routes>
    </Router>
  );
}

export default App;
