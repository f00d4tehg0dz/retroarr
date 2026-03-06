import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import retroApi from '../api/retroApi';

export function useChannels(filters = {}) {
  return useQuery({
    queryKey: ['channels', filters],
    queryFn: () =>
      retroApi
        .get('/channels', { params: filters })
        .then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useChannel(id) {
  return useQuery({
    queryKey: ['channels', id],
    queryFn: () => retroApi.get(`/channels/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useNowPlaying() {
  return useQuery({
    queryKey: ['nowplaying'],
    queryFn: () => retroApi.get('/channels/nowplaying').then((r) => r.data),
    refetchInterval: 30_000,
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => retroApi.patch(`/channels/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}
