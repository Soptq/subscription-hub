import * as React from "react";
import { Block } from 'baseui/block';
import { Heading, HeadingLevel } from 'baseui/heading'
import { StatefulTabs, Tab } from "baseui/tabs-motion";

import Introduction from "./components/Introduction";
import Configuration from "./components/Configuration";
import './App.css';
import ServiceAction from "./components/ServiceAction";
import UserAction from "./components/UserAction";
import {Card, StyledBody} from 'baseui/card';
import HubConfigurationTable from "./components/Dashboard";
import {ParagraphLarge} from "baseui/typography";


function App() {
    const [configured, setConfigured] = React.useState(false);

    const configuredCallback = () => {
        setConfigured(true);
    }

    return (
        <Block width="600px">
            <HeadingLevel>
                <Heading>
                  Subscription Hub
                </Heading>
                <ParagraphLarge>Manage all your subscriptions on Web3 in one place.</ParagraphLarge>
                <StatefulTabs>
                    <Tab title="Configuration">
                        <Card>
                            <StyledBody>
                                You have to configure the application before you can access the other two tabs.
                            </StyledBody>
                        </Card>
                        <Introduction />
                        <Configuration configuredCallback={configuredCallback} />
                    </Tab>
                    <Tab title="Service" disabled={!configured}>
                        <HubConfigurationTable />
                        <ServiceAction />
                    </Tab>
                    <Tab title="User" disabled={!configured}>
                        <HubConfigurationTable />
                        <UserAction />
                    </Tab>
                </StatefulTabs>
                <div style={{marginTop: 200, marginBottom: 200}}/>
          </HeadingLevel>
      </Block>
  );
}

export default App;
