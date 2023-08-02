import './App.css';
import { Button, ActionList, ButtonGroup, Box, PageLayout, ThemeProvider } from '@primer/react'
import { Section } from './components/containerComponents.js';
import PrimaryButton from './components/interactionComponents.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCoffee } from '@fortawesome/free-solid-svg-icons'
import { TitleSection } from './components/sectionComponents';
import "./primer.css"

function Layout() {

  const LT_Icon = <FontAwesomeIcon icon={faCoffee} />

  return <>
    <PageLayout>
      <PageLayout.Header>
        <TitleSection title="Temperatur" subtitle="19:20" />
        <FontAwesomeIcon icon={["fab", "github"]} />
      </PageLayout.Header>
      <PageLayout.Content>
        <Section text={"Content!"} content={PrimaryButton} />
      </PageLayout.Content>
      <PageLayout.Pane>
        <Box borderWidth="1px" borderStyle="solid" borderColor="border.default" borderRadius={2}>
          <ActionList>
            <ActionList.Item leadingIcon={LT_Icon}>Temperatur</ActionList.Item>
            <ActionList.Item>Luftfeuchtigkeit</ActionList.Item>
            <ActionList.Item>Windgeschwindigkeit</ActionList.Item>
          </ActionList>
        </Box>
      </PageLayout.Pane>
      <PageLayout.Footer>
        <Section text={"Footer!"} content={PrimaryButton} />
      </PageLayout.Footer>
    </PageLayout>
  </>
}

export default function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <Layout />
      </div>
    </ThemeProvider>
  );
}