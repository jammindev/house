import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Mount a React component to a DOM element
 * Usage in Django template:
 * 
 * <div id="my-component" data-props='{"userId": 123}'></div>
 * <script type="module">
 *   import { mountComponent } from '{% static "react/mount.js" %}';
 *   import LoginForm from '{% static "react/LoginForm.js" %}';
 *   mountComponent('my-component', LoginForm);
 * </script>
 */
export function mountComponent(elementId: string, Component: React.ComponentType<any>) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found`);
    return;
  }

  // Parse props from data-props attribute
  const propsJson = element.getAttribute('data-props');
  const props = propsJson ? JSON.parse(propsJson) : {};

  const root = createRoot(element);
  root.render(
    <StrictMode>
      <Component {...props} />
    </StrictMode>
  );
}

// Auto-mount components with data-react-component attribute
export function autoMount() {
  document.querySelectorAll('[data-react-component]').forEach((element) => {
    const componentName = element.getAttribute('data-react-component');
    const propsJson = element.getAttribute('data-props');
    const props = propsJson ? JSON.parse(propsJson) : {};

    // You'll need to register components here or use dynamic imports
    console.log(`Auto-mounting ${componentName} with props:`, props);
  });
}
