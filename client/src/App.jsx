import Header from './components/layout/Header';
import Dashboard from './components/layout/Dashboard';

function App() {
  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      <Header />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Dashboard />
      </main>
    </div>
  );
}

export default App;
