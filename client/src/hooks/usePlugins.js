import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import retroApi from '../api/retroApi';

export function usePluginRepo() {
  return useQuery({
    queryKey: ['pluginRepo'],
    queryFn: () => retroApi.get('/plugins/repo').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useInstalledPlugins() {
  return useQuery({
    queryKey: ['pluginsInstalled'],
    queryFn: () => retroApi.get('/plugins/installed').then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useInstallPlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pluginId) =>
      retroApi.post('/plugins/install', { pluginId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pluginRepo'] });
      queryClient.invalidateQueries({ queryKey: ['pluginsInstalled'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useUninstallPlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pluginId) =>
      retroApi.post('/plugins/uninstall', { pluginId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pluginRepo'] });
      queryClient.invalidateQueries({ queryKey: ['pluginsInstalled'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}
