import { useMutation } from '@tanstack/react-query';
import { askAgent, type AgentAnswer } from './api';

export function useAskAgent() {
  return useMutation<AgentAnswer, unknown, string>({
    mutationFn: (question: string) => askAgent(question),
  });
}
