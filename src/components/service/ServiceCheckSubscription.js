import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import {Input, SIZE} from "baseui/input";
import {useContext, useState, useCallback, useEffect} from "react";
import {Button} from "baseui/button";

import {ethers} from "ethers";
import {useSnackbar} from "baseui/snackbar";
import {Context} from "../../Context";
import {Tag, VARIANT} from 'baseui/tag';
import { debounce } from "lodash";

const variants = Object.keys(VARIANT);
const { default: Resolution } = require('@unstoppabledomains/resolution');

function ServiceCheckSubscription() {
    const [address, setAddress] = useState("");
    const [serviceHash, setServiceHash] = useState("");
    const [loading, setLoading] = useState(false);

    const [subscribed, setSubscribed] = useState(false);
    const [willRenew, setWillRenew] = useState(false);

    const { context } = useContext(Context);
    const { enqueue } = useSnackbar();

    const udResolution = new Resolution();
    const supportedUDDomains = [".zil", ".crypto", ".nft", ".blockchain", ".bitcoin", "coin", "wallet", ".888", ".dao", ".x"]

    const debouncedDomainLookup = useCallback(debounce((value, setFn) => {
        if (supportedUDDomains.some(postfix => value.endsWith(postfix))) {
            // try resolve ud domain
            udResolution.addr(value, "ETH")
                .then((address) => setFn(address))
                .catch(e => {
                    console.warn("Failed to resolve a possible UD domain", e)
                });
        }
    }, 1000), [])

    useEffect(() => {
        return () => {
            debouncedDomainLookup.cancel();
        }
    }, []);

    const checkSubscription = async () => {
        setLoading(true);
        try {
            const retrievedConfig = await context.contract.getServiceConfiguration(serviceHash);
            const [ , , , , version] = ethers.utils.defaultAbiCoder.decode(
                ["address", "address", "address", "uint256", "uint256"],
                retrievedConfig,
            );
            const checkedAddress = ethers.utils.getAddress(address);
            const subscribed = await context.contract.checkSubscribed(checkedAddress, serviceHash, version);
            const willRenew = await context.contract.checkRenewal(checkedAddress, serviceHash, version);
            setSubscribed(subscribed);
            setWillRenew(willRenew);
            setLoading(false);
        } catch (e) {
            console.log(e);
            enqueue({
                message: "Failed to fetch: " + e.toString(),
                kind: "error",
            });
            setLoading(false);
        }
    }

    return (
        <HeadingLevel>
            <Heading>Check User Subscription</Heading>
            <ParagraphSmall>Here you can check if a given user is subscribing your service. By using this data you can provide custom services for your clients.</ParagraphSmall>
            <Input
                value={serviceHash}
                onChange={e => setServiceHash(e.currentTarget.value)}
                size={SIZE.compact}
                placeholder="service hash (ID)"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Input
                value={address}
                onChange={e => {
                    debouncedDomainLookup(e.currentTarget.value, setAddress);
                    setAddress(e.currentTarget.value)
                }}
                size={SIZE.compact}
                placeholder="user wallet address"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={loading} onClick={checkSubscription}>
                Check
            </Button>
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <>
                <ParagraphSmall>
                    <Tag closeable={false} variant={variants[1]} kind="positive">
                        Subscribed
                    </Tag><strong>{subscribed.toString()}</strong>
                </ParagraphSmall>
                <ParagraphSmall>
                    <Tag closeable={false} variant={variants[1]} kind="positive">
                        Will Renew
                    </Tag><strong>{willRenew.toString()}</strong>
                </ParagraphSmall>
            </>
        </HeadingLevel>
    )
}

export default ServiceCheckSubscription;