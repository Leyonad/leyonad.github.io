import './App.css';
import { PageLayout, ThemeProvider } from '@primer/react'
import Section from './components/containerComponents.js';
import PrimaryButton from './components/interactionComponents.js';


function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <PageLayout>
          <PageLayout.Header>
            <Section text={"Header!"} content={PrimaryButton}/>
          </PageLayout.Header>
          <PageLayout.Content>
            <Section text={"Content!"} content={PrimaryButton} />
          </PageLayout.Content>
          <PageLayout.Pane>
            <Section text={"Pane!"} content={PrimaryButton} />
          </PageLayout.Pane>
          <PageLayout.Footer>
            <Section text={"Footer!"} content={PrimaryButton} />
          </PageLayout.Footer>
        </PageLayout>
      </div>
    </ThemeProvider>
  );
}

export default App;
