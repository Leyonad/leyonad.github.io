import './App.css';
import { ActionList, Box, PageLayout, PageHeader, ThemeProvider } from '@primer/react'
import { Section } from './components/containerComponents.js';
import PrimaryButton from './components/interactionComponents.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCoffee } from '@fortawesome/free-solid-svg-icons'
import { TitleSection } from './components/sectionComponents';
import "./primer.css"
import GlobalHeader from './components/globalComponents';

function Layout() {

  const LT_Icon = <FontAwesomeIcon icon={faCoffee} />

  return <>
    <GlobalHeader />
    <PageLayout>
      <PageLayout.Header>
        <Header>
          <Header.Item>Item 1</Header.Item>
          <Header.Item full border={1} borderStyle="solid">
            Item 2
          </Header.Item>
          <Header.Item sx={{ mr: 0 }}>Item 3</Header.Item>
        </Header>
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