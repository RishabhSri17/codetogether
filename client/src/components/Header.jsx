import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <header className="p-4 bg-blue-600 text-white font-bold text-lg">
      <Link to="/"><span>Code</span><span>Together</span></Link>
    </header>
  );
}

export default Header;
