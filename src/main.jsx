import React from 'react';
import { createRoot } from 'react-dom/client';
import TowingGame from './game/TowingGame.jsx';
import './style.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><TowingGame /></React.StrictMode>);
