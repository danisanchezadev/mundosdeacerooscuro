import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StarRating, { StarInput } from '../components/StarRating';
import Pagination from '../components/Pagination';
import BookCard from '../components/BookCard';
import Cover from '../components/Cover';
import Field from '../components/Field';
import { renderWithProviders, sampleBook } from './utils';

describe('StarRating', () => {
  it('exposes the rating accessibly', () => {
    renderWithProviders(<StarRating value="3.6" count={5} />, { withAuth: false });
    expect(screen.getByRole('img', { name: 'Valoración 3.6 de 5' })).toBeInTheDocument();
    expect(screen.getByText('(5)')).toBeInTheDocument();
  });

  it('StarInput reports the selected value', async () => {
    const onChange = vi.fn();
    renderWithProviders(<StarInput value={2} onChange={onChange} />, { withAuth: false });
    await userEvent.click(screen.getByRole('button', { name: '4 estrellas' }));
    expect(onChange).toHaveBeenCalledWith(4);
    expect(screen.getByRole('button', { name: '2 estrellas' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = renderWithProviders(<Pagination page={1} count={5} pageSize={12} onChange={() => {}} />, { withAuth: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('navigates and disables the edges', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Pagination page={1} count={30} pageSize={12} onChange={onChange} />, { withAuth: false });
    expect(screen.getByRole('button', { name: /ANT/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /SIG/ }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.getByText(/PÁGINA 1 \/ 3/)).toBeInTheDocument();
  });
});

describe('BookCard', () => {
  it('links to the detail page and shows availability', () => {
    renderWithProviders(<BookCard book={sampleBook} />, { withAuth: false });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/books/1');
    expect(screen.getByText('Frank Herbert')).toBeInTheDocument();
    expect(screen.getByText('DISPONIBLE')).toBeInTheDocument();
  });

  it('shows lent and unavailable states', () => {
    const lent = renderWithProviders(<BookCard book={{ ...sampleBook, loan_availability: 'lent' }} />, { withAuth: false });
    expect(screen.getByText('PRESTADO')).toBeInTheDocument();
    lent.unmount();
    renderWithProviders(<BookCard book={{ ...sampleBook, loan_availability: 'none' }} />, { withAuth: false });
    expect(screen.getByText('SIN EJEMPLARES')).toBeInTheDocument();
  });
});

describe('Cover', () => {
  it('falls back to a placeholder when the image fails', async () => {
    renderWithProviders(<Cover url="https://example.com/x.jpg" title="Dune" />, { withAuth: false });
    const img = screen.getByRole('img', { name: 'Portada de Dune' });
    img.dispatchEvent(new Event('error'));
    expect(await screen.findByText('SIN PORTADA')).toBeInTheDocument();
  });

  it('renders a placeholder without url', () => {
    renderWithProviders(<Cover title="Dune" />, { withAuth: false });
    expect(screen.getByText('SIN PORTADA')).toBeInTheDocument();
  });
});

describe('Field', () => {
  it('links label, control and error message', () => {
    renderWithProviders(<Field label="Email" error="Inválido" defaultValue="" />, { withAuth: false });
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Inválido');
  });
});
