import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  authorsService,
  awardsService,
  booksService,
  cleanParams,
  loansService,
  reservationsService,
  reviewCommentsService,
  reviewsService,
  sagasService,
  userBooksService,
  usersService,
} from '../services/resources';

export const SERVICES = {
  books: booksService,
  authors: authorsService,
  sagas: sagasService,
  awards: awardsService,
  reviews: reviewsService,
  'review-comments': reviewCommentsService,
  'user-books': userBooksService,
  loans: loansService,
  reservations: reservationsService,
  users: usersService,
};

// Resources whose computed fields (ratings, availability, counts) depend on other resources.
const RELATED = {
  reviews: ['books'],
  'review-comments': ['reviews'],
  'user-books': ['books', 'loans'],
  loans: ['books', 'user-books', 'reservations', 'users'],
  reservations: ['books'],
  authors: ['books'],
  sagas: ['books'],
  awards: ['books'],
};

export function useList(resource, params = {}, options = {}) {
  const clean = cleanParams(params);
  return useQuery({
    queryKey: [resource, 'list', clean],
    queryFn: () => SERVICES[resource].list(clean),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useDetail(resource, id, options = {}) {
  return useQuery({
    queryKey: [resource, 'detail', String(id)],
    queryFn: () => SERVICES[resource].retrieve(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useInvalidate() {
  const queryClient = useQueryClient();
  return (resource) => {
    queryClient.invalidateQueries({ queryKey: [resource] });
    (RELATED[resource] ?? []).forEach((related) => queryClient.invalidateQueries({ queryKey: [related] }));
  };
}

/** create / update / remove mutations for a resource, invalidating dependent queries. */
export function useResourceMutations(resource) {
  const invalidate = useInvalidate();
  const service = SERVICES[resource];
  const onSuccess = () => invalidate(resource);

  return {
    create: useMutation({ mutationFn: (payload) => service.create(payload), onSuccess }),
    update: useMutation({ mutationFn: ({ id, ...payload }) => service.update(id, payload), onSuccess }),
    remove: useMutation({ mutationFn: (id) => service.remove(id), onSuccess }),
  };
}

export function useLoanAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action }) => loansService.act(id, action),
    onSuccess: () => invalidate('loans'),
  });
}

export function useRequestLoan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (userBookId) => loansService.request(userBookId),
    onSuccess: () => invalidate('loans'),
  });
}
