import { render, screen } from '@testing-library/react';
import ModuleCard from '../../../../app/_components/ui/ModuleCard';
import '@testing-library/jest-dom';

describe('ModuleCard', () => {
  it('renders the module name and description', () => {
    render(
      <ModuleCard
        name="Test Module"
        description="This is a test description."
        href="/test-module"
      />
    );

    const nameElement = screen.getByText('Test Module');
    const descriptionElement = screen.getByText('This is a test description.');

    expect(nameElement).toBeInTheDocument();
    expect(descriptionElement).toBeInTheDocument();
  });

  it('renders a link with the correct href', () => {
    render(
      <ModuleCard
        name="Test Module"
        description="This is a test description."
        href="/test-module"
      />
    );

    const linkElement = screen.getByRole('link');
    expect(linkElement).toHaveAttribute('href', '/test-module');
  });
});
