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
import {ParagraphLarge, ParagraphSmall} from "baseui/typography";
import {Button} from "baseui/button";
import {
    Modal,
} from "baseui/modal";

import * as HyphenWidget from "@biconomy/hyphen-widget";
import "@biconomy/hyphen-widget/dist/index.css";
import {useEffect} from "react";


function App() {
    const [configured, setConfigured] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);

    useEffect(() => {
        if (isOpen) {
            (async () => {
                await new Promise(resolve => setTimeout(resolve, 1000));
                HyphenWidget.default.init(document.getElementById("hyphen-widget"), {
                    tag: "Subscription Hub",
                    showWidget: true,
                });
            })()
        }
    }, [isOpen])

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
                <div style={{marginTop: 10}}/>
                <Button size="compact" onClick={() => {
                    window.open(
                        `https://staging-global.transak.com/?apiKey=${process.env.REACT_APP_TRANSAK_API_KEY}`,
                        '_blank'
                    ).focus()
                }}>
                    Purchase Some Tokens
                </Button>
                <div style={{marginTop: 5, marginBottom: 5}}/>
                <Button size="compact" onClick={() => {
                    setIsOpen(true);
                }}>
                    Swap Some Tokens
                </Button>
                <Modal
                    onClose={() => setIsOpen(false)}
                    closeable
                    isOpen={isOpen}
                    animate
                    autoFocus
                >
                    <div id="hyphen-widget"></div>
                </Modal>
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
                <ParagraphSmall>Github Repo: https://github.com/Soptq/subscription-hub</ParagraphSmall>
          </HeadingLevel>
      </Block>
  );
}

export default App;
