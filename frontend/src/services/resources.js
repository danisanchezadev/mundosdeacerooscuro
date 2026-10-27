import { api } from './api';

/** Generic REST resource client: list/retrieve/create/update/remove. */
export function createResource(path) {
  return {
    async list(params = {}) {
      const { data } = await api.get(`/${path}/`, { params });
      return data;
    },
    async retrieve(id) {
      const { data } = await api.get(`/${path}/${id}/`);
      return data;
    },
    async create(payload) {
      const { data } = await api.post(`/${path}/`, payload);
      return data;
    },
    async update(id, payload) {
      const { data } = await api.patch(`/${path}/${id}/`, payload);
      return data;
    },
    async remove(id) {
      await api.delete(`/${path}/${id}/`);
    },
  };
}

export const booksService = createResource('books');
export const authorsService = createResource('authors');
export const sagasService = createResource('sagas');
export const awardsService = createResource('awards');
export const reviewsService = createResource('reviews');
export const reviewCommentsService = createResource('review-comments');
export const userBooksService = createResource('user-books');
export const reservationsService = createResource('reservations');
export const usersService = createResource('users');

export const loansService = {
  ...createResource('loans'),
  async request(userBookId) {
    const { data } = await api.post('/loans/', { user_book: userBookId });
    return data;
  },
  async act(id, action) {
    const path = action.replace('_', '-');
    const { data } = await api.post(`/loans/${id}/${path}/`);
    return data;
  },
};

/** Removes empty values so they are not sent as filters. */
export function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== false),
  );
}
