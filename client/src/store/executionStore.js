import { create } from 'zustand';
import { EXECUTION_STATUS } from '../utils/constants';
import { createExecutionSocket } from '../services/api';

const useExecutionStore = create((set, get) => ({
  status: EXECUTION_STATUS.IDLE,
  executionId: null,
  snapshots: [],
  currentStep: 0,
  output: { stdout: '', stderr: '', exitCode: null },
  error: null,
  metadata: null,
  
  // Real-time state
  socket: null,
  isWaitingForInput: false,
  isStreaming: false,
  
  // Replay state
  isPlaying: false,
  replaySpeed: 1000,
  replayTimer: null,
  
  startExecution: (code, language) => {
    const { socket: oldSocket, stopReplay } = get();
    if (oldSocket) oldSocket.disconnect();
    stopReplay();

    const socket = createExecutionSocket();
    
    set({ 
      status: EXECUTION_STATUS.RUNNING,
      snapshots: [],
      currentStep: 0,
      output: { stdout: '', stderr: '', exitCode: null },
      error: null,
      socket,
      isStreaming: true,
      isWaitingForInput: false
    });

    socket.emit('execute', { code, language });

    socket.on('snapshot', (snapshot) => {
      const { snapshots, isStreaming } = get();
      
      // Update waiting state based on the current snapshot
      if (snapshot.event === 'input_waiting') {
        set({ isWaitingForInput: true });
      } else {
        // Any other event (line, output, stdin echo) means we are no longer blocking for input
        set({ isWaitingForInput: false });
      }

      const newSnapshots = [...snapshots, snapshot];
      set({ snapshots: newSnapshots });
      
      // Auto-step if streaming
      if (isStreaming) {
        set({ currentStep: newSnapshots.length - 1 });
      }
    });

    socket.on('stderr', (data) => {
      set((state) => ({
        output: { ...state.output, stderr: state.output.stderr + data }
      }));
    });

    socket.on('exit', ({ exitCode }) => {
      set((state) => ({
        status: EXECUTION_STATUS.COMPLETED,
        output: { ...state.output, exitCode },
        isStreaming: false,
        isWaitingForInput: false,
        currentStep: state.snapshots.length > 0 ? state.snapshots.length - 1 : 0
      }));
    });

    socket.on('error', (error) => {
      set({ status: EXECUTION_STATUS.ERROR, error, isStreaming: false });
    });
  },

  sendInput: (input) => {
    const { socket } = get();
    if (socket) {
      socket.emit('stdin', input);
    }
  },

  stopExecution: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('stop');
      socket.disconnect();
    }
    set({ status: EXECUTION_STATUS.IDLE, socket: null, isStreaming: false });
  },

  setCurrentStep: (step) => {
    const { snapshots, isStreaming } = get();
    if (step >= 0 && step < snapshots.length) {
      set({ 
        currentStep: step,
        // If user manually navigates, stop "streaming" follow
        isStreaming: false 
      });
    }
  },
  
  nextStep: () => {
    const { currentStep, snapshots, isPlaying } = get();
    if (currentStep < snapshots.length - 1) {
      set({ currentStep: currentStep + 1 });
    } else if (isPlaying) {
      get().stopReplay();
    }
  },
  
  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1, isStreaming: false });
    }
  },
  
  startReplay: () => {
    const { replaySpeed, nextStep, snapshots, currentStep } = get();
    if (currentStep >= snapshots.length - 1) {
      set({ currentStep: 0 });
    }
    const timer = setInterval(() => {
      nextStep();
    }, replaySpeed);
    set({ isPlaying: true, replayTimer: timer, isStreaming: false });
  },
  
  stopReplay: () => {
    const { replayTimer } = get();
    if (replayTimer) clearInterval(replayTimer);
    set({ isPlaying: false, replayTimer: null });
  },
  
  setReplaySpeed: (speed) => {
    const { isPlaying, replayTimer } = get();
    set({ replaySpeed: speed });
    if (isPlaying) {
      if (replayTimer) clearInterval(replayTimer);
      const timer = setInterval(() => {
        get().nextStep();
      }, speed);
      set({ replayTimer: timer });
    }
  },
  
  reset: () => {
    get().stopExecution();
    get().stopReplay();
    set({
      status: EXECUTION_STATUS.IDLE,
      snapshots: [],
      currentStep: 0,
      output: { stdout: '', stderr: '', exitCode: null },
      error: null,
      isStreaming: false,
      isWaitingForInput: false,
    });
  },
}));

export default useExecutionStore;
