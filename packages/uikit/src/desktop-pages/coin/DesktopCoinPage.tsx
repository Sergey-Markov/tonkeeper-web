import React, { FC, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppRoute } from '../../libs/routes';
import { useTranslation } from '../../hooks/translation';
import { useAppContext } from '../../hooks/appContext';
import { useFetchNext } from '../../hooks/useFetchNext';
import {
    DesktopViewDivider,
    DesktopViewHeader,
    DesktopViewPageLayout
} from '../../components/desktop/DesktopViewLayout';
import { Body2, Label2, Num3 } from '../../components/Text';
import { BLOCKCHAIN_NAME, CryptoCurrency } from '@tonkeeper/core/dist/entries/crypto';
import styled from 'styled-components';
import { shiftedDecimals } from '@tonkeeper/core/dist/utils/balance';
import { formatFiatCurrency, useFormatCoinValue } from '../../hooks/balance';
import { useRate } from '../../state/rates';
import { useAssets } from '../../state/home';
import BigNumber from 'bignumber.js';
import { eqAddresses } from '@tonkeeper/core/dist/utils/address';
import { Button } from '../../components/fields/Button';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, SwapIcon } from '../../components/Icon';
import { DesktopExternalLinks } from '../../libs/externalLinks';
import { useAppSdk } from '../../hooks/appSdk';
import { BuyNotification } from '../../components/home/BuyAction';
import { useDisclosure } from '../../hooks/useDisclosure';
import { useTonendpointBuyMethods } from '../../state/tonendpoint';
import { useFetchFilteredActivity } from '../../state/activity';
import { DesktopHistory } from '../../components/desktop/history/DesktopHistory';
import { getMixedActivity } from '../../state/mixedActivity';

export const DesktopCoinPage = () => {
    const navigate = useNavigate();
    const { name } = useParams();

    useEffect(() => {
        if (!name) {
            navigate(AppRoute.home);
        }
    }, [name]);

    if (!name) return <></>;

    const token = name === 'ton' ? CryptoCurrency.TON : name;

    return <CoinPage token={token} />;
};

const DesktopViewHeaderStyled = styled(DesktopViewHeader)`
    margin-bottom: 0.5rem;
`;

const CoinPageBody = styled.div`
    padding: 0 1rem;
`;

const HeaderButtonsContainer = styled.div`
    padding-bottom: 1rem;
    display: flex;
    gap: 0.5rem;
`;

const ButtonStyled = styled(Button)`
    display: flex;
    gap: 6px;

    > svg {
        color: ${p => p.theme.buttonTertiaryForeground};
    }
`;

const CoinHeader: FC<{ token: string }> = ({ token }) => {
    const { t } = useTranslation();
    const { isOpen, onClose, onOpen } = useDisclosure();
    const { data: buy } = useTonendpointBuyMethods();
    const canBuy = token === CryptoCurrency.TON;

    const sdk = useAppSdk();
    return (
        <>
            <CoinInfo token={token} />
            <HeaderButtonsContainer>
                <ButtonStyled
                    size="small"
                    onClick={() =>
                        sdk.uiEvents.emit('transfer', {
                            method: 'transfer',
                            id: Date.now(),
                            params: { asset: token, chain: BLOCKCHAIN_NAME.TON }
                        })
                    }
                >
                    <ArrowUpIcon />
                    {t('wallet_send')}
                </ButtonStyled>
                <ButtonStyled
                    size="small"
                    onClick={() => {
                        sdk.uiEvents.emit('receive', {
                            method: 'receive',
                            params: {}
                        });
                    }}
                >
                    <ArrowDownIcon />
                    {t('wallet_receive')}
                </ButtonStyled>
                <ButtonStyled size="small" onClick={() => sdk.openPage(DesktopExternalLinks.Swap)}>
                    <SwapIcon />
                    {t('wallet_swap')}
                </ButtonStyled>
                {canBuy && (
                    <ButtonStyled size="small" onClick={onOpen}>
                        <PlusIcon />
                        {t('wallet_buy')}
                    </ButtonStyled>
                )}
            </HeaderButtonsContainer>
            <BuyNotification buy={buy} open={isOpen} handleClose={onClose} />
        </>
    );
};

const CoinInfoWrapper = styled.div`
    padding: 1rem 0;
    display: flex;

    gap: 1rem;

    > img {
        width: 56px;
        height: 56px;
        border-radius: 50%;
    }
`;

const CoinInfoAmounts = styled.div`
    > * {
        display: block;
    }

    > ${Body2} {
        color: ${p => p.theme.textSecondary};
    }
`;

const CoinInfo: FC<{ token: string }> = ({ token }) => {
    const [assets] = useAssets();
    const format = useFormatCoinValue();
    const { data: tonRate } = useRate(CryptoCurrency.TON);
    const { fiat } = useAppContext();

    const asset: { symbol: string; image: string; amount: string; fiatAmount: string } | undefined =
        useMemo(() => {
            if (!assets || !tonRate) {
                return undefined;
            }

            if (token === CryptoCurrency.TON) {
                const amount = assets.ton.info.balance;
                return {
                    image: 'https://wallet.tonkeeper.com/img/toncoin.svg',
                    symbol: 'TON',
                    amount: format(amount),
                    fiatAmount: formatFiatCurrency(
                        fiat,
                        new BigNumber(tonRate.prices).multipliedBy(shiftedDecimals(amount))
                    )
                };
            }

            const jettonBalance = assets.ton.jettons.balances.find(b =>
                eqAddresses(b.jetton.address, token)
            );

            if (!jettonBalance) {
                return undefined;
            }

            const amount = jettonBalance.balance;

            return {
                image: jettonBalance.jetton.image,
                symbol: jettonBalance.jetton.symbol,
                amount: format(amount, jettonBalance.jetton.decimals),
                fiatAmount: formatFiatCurrency(
                    fiat,
                    new BigNumber(tonRate.prices).multipliedBy(
                        shiftedDecimals(jettonBalance.balance, jettonBalance.jetton.decimals)
                    )
                )
            };
        }, [assets, format, tonRate, fiat]);

    if (!asset) {
        return <></>;
    }

    return (
        <CoinInfoWrapper>
            <img src={asset.image} alt={asset.symbol} />
            <CoinInfoAmounts>
                <Num3>
                    {asset.amount}&nbsp;{asset.symbol}
                </Num3>
                <Body2>{asset.fiatAmount}</Body2>
            </CoinInfoAmounts>
        </CoinInfoWrapper>
    );
};

export const CoinPage: FC<{ token: string }> = ({ token }) => {
    const { t } = useTranslation();
    const ref = useRef<HTMLDivElement>(null);

    const { standalone } = useAppContext();

    const { fetchNextPage, hasNextPage, isFetchingNextPage, data } =
        useFetchFilteredActivity(token);

    useFetchNext(hasNextPage, isFetchingNextPage, fetchNextPage, standalone, ref);

    const activity = useMemo(() => {
        return getMixedActivity(data, undefined);
    }, [data]);

    return (
        <DesktopViewPageLayout ref={ref}>
            <DesktopViewHeaderStyled backButton>
                <Label2>{t('Toncoin')}</Label2>
            </DesktopViewHeaderStyled>
            <DesktopViewDivider />
            <CoinPageBody>
                <CoinHeader token={token} />
                <DesktopHistory isFetchingNextPage={isFetchingNextPage} activity={activity} />
            </CoinPageBody>
        </DesktopViewPageLayout>
    );
};
