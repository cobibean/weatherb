import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SuggestionsPage from '../page';

describe('Admin Suggestions Page', () => {
  it('should render the page header', async () => {
    const Page = await SuggestionsPage();
    render(Page);

    expect(screen.getByText('City Suggestions')).toBeInTheDocument();
    expect(screen.getByText(/Manage and review city suggestions/i)).toBeInTheDocument();
  });

  it('should render loading fallback initially', async () => {
    const Page = await SuggestionsPage();
    const { container } = render(Page);

    // The page should render with Suspense fallback (loading skeletons)
    const loadingElements = container.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('should render with proper structure', async () => {
    const Page = await SuggestionsPage();
    const { container } = render(Page);

    // Check for the container structure
    const mainContainer = container.querySelector('.max-w-6xl');
    expect(mainContainer).toBeInTheDocument();
  });
});
