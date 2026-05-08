import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import CodeEditor from '../editor/CodeEditor';
import EditorToolbar from '../editor/EditorToolbar';
import ExecutionControls from '../execution/ExecutionControls';
import StepTimeline from '../execution/StepTimeline';
import VariableInspector from '../visualization/VariableInspector';
import StackVisualizer from '../visualization/StackVisualizer';
import MemoryVisualizer from '../visualization/MemoryVisualizer';
import TracePanel from '../visualization/TracePanel';
import Terminal from '../terminal/Terminal';
import useUIStore from '../../store/uiStore';
import useExecutionStore from '../../store/executionStore';
import { EXECUTION_STATUS } from '../../utils/constants';

function PanelHeader({ title, icon, badge, children }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg-secondary/50">
      <div className="flex items-center gap-2">
        {icon && <span className="text-text-muted">{icon}</span>}
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {title}
        </span>
        {badge && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-accent-primary/20 text-accent-primary rounded-full">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function VisualizationTabs() {
  const { activePanel, setActivePanel } = useUIStore();
  const tabs = [
    { id: 'variables', label: 'Variables', icon: '📊' },
    { id: 'stack', label: 'Call Stack', icon: '📚' },
    { id: 'memory', label: 'Memory', icon: '🧠' },
    { id: 'trace', label: 'Trace', icon: '📋' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border-default bg-bg-secondary/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
              activePanel === tab.id
                ? 'text-accent-primary border-accent-primary bg-accent-primary/5'
                : 'text-text-muted border-transparent hover:text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {activePanel === 'variables' && <VariableInspector />}
        {activePanel === 'stack' && <StackVisualizer />}
        {activePanel === 'memory' && <MemoryVisualizer />}
        {activePanel === 'trace' && <TracePanel />}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { status, snapshots } = useExecutionStore();
  const hasExecution = (status === EXECUTION_STATUS.COMPLETED || status === EXECUTION_STATUS.RUNNING) && snapshots.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Execution Controls Bar */}
      <ExecutionControls />
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Left: Code Editor */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col border-r border-border-default">
              <EditorToolbar />
              <div className="flex-1 overflow-hidden">
                <CodeEditor />
              </div>
            </div>
          </Panel>

          <PanelResizeHandle />

          {/* Right: Visualization */}
          <Panel defaultSize={50} minSize={25}>
            <PanelGroup direction="vertical" className="h-full">
              {/* Top Right: Variable/Stack/Memory Inspector */}
              <Panel defaultSize={55} minSize={20}>
                <div className="h-full flex flex-col">
                  {hasExecution ? (
                    <>
                      <StepTimeline />
                      <div className="flex-1 overflow-hidden">
                        <VisualizationTabs />
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-text-muted gap-3 p-8">
                      <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
                        <span className="text-3xl">🚀</span>
                      </div>
                      <p className="text-sm font-medium text-text-secondary">
                        Run your code to see the visualization
                      </p>
                      <p className="text-xs text-text-muted text-center max-w-xs">
                        Write code in the editor and click "Run" to see step-by-step 
                        execution with variable tracking, call stack, and memory visualization.
                      </p>
                    </div>
                  )}
                </div>
              </Panel>

              <PanelResizeHandle />

              {/* Bottom Right: Terminal */}
              <Panel defaultSize={45} minSize={15}>
                <Terminal />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
