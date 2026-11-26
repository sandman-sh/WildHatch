use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{
    self, CloseAccount, Mint, MintTo, SetAuthority, Token, TokenAccount, TransferChecked,
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use ephemeral_vrf_sdk::{
    anchor::{vrf, vrf_callback},
    instructions::{create_request_scoped_randomness_ix, RequestRandomnessParams},
    rnd::random_u8_with_range,
    types::SerializableAccountMeta,
};

#[cfg(not(feature = "local-vrf"))]
use ephemeral_vrf_sdk::consts::DEFAULT_QUEUE as BOX_QUEUE;
#[cfg(feature = "local-vrf")]
use ephemeral_vrf_sdk::consts::DEFAULT_TEST_QUEUE as BOX_QUEUE;

declare_id!("BUfh4GsJjyH52oLkgyG3U2UT7qJwo6opLDmEUW4w7PpJ");

const DUEL: &[u8] = b"duel";
const OFFER: &[u8] = b"offer";
const VAULT: &[u8] = b"vault";
const TURN_SECS: i64 = 180;
const CURRENCY: &[u8] = b"wild";
const BEAST: &[u8] = b"beast";
#[cfg(not(feature = "local-rollup"))]
const ROLLUP_VALIDATOR: Pubkey = pubkey!("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");
#[cfg(feature = "local-rollup")]
const ROLLUP_VALIDATOR: Pubkey = pubkey!("mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev");
const DEPLOYER: Pubkey = pubkey!("3azzbKB2FBqNjwd6HVnz1vjcqfA2whrj8SeaMVYBEfE6");

#[ephemeral]
#[program]
pub mod wildhatch {
    use super::*;

    pub fn create_duel(ctx: Context<CreateDuel>, nonce: u64, opponent: Pubkey) -> Result<()> {
        require!(
            opponent != ctx.accounts.host.key() && opponent != Pubkey::default(),
            WildError::InvalidOpponent
        );
        ctx.accounts.duel.set_inner(Duel {
            host: ctx.accounts.host.key(),
            opponent,
            nonce,
            hp: [40, 40],
            guarding: [false, false],
            burn: [0, 0],
            turn: 0,
            moves: 0,
            last_move: 0,
            last_damage: 0,
            deadline: Clock::get()?.unix_timestamp + 600,
            state: 0,
            rewarded: false,
            rolled_up: false,
        });
        Ok(())
    }

    pub fn join_duel(ctx: Context<JoinDuel>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let duel = &mut ctx.accounts.duel;
        require!(
            duel.state == 0 && now < duel.deadline,
            WildError::MatchUnavailable
        );
        duel.state = 1;
        duel.deadline = now + TURN_SECS;
        Ok(())
    }

    pub fn play_move(ctx: Context<PlayDuel>, action: u8, expected_moves: u16) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let duel = &mut ctx.accounts.duel;
        require!(
            duel.state == 1 && duel.moves == expected_moves && now < duel.deadline,
            WildError::MatchUnavailable
        );
        let player = duel.turn as usize;
        require_keys_eq!(
            duel.players()[player],
            ctx.accounts.player.key(),
            WildError::WrongTurn
        );
        duel.resolve_move(action, now)
    }

    pub fn claim_timeout(ctx: Context<PlayDuel>) -> Result<()> {
        let duel = &mut ctx.accounts.duel;
        require!(
            duel.state == 1 && Clock::get()?.unix_timestamp >= duel.deadline,
            WildError::MatchUnavailable
        );
        let winner = 1 - duel.turn;
        require_keys_eq!(
            duel.players()[winner as usize],
            ctx.accounts.player.key(),
            WildError::WrongTurn
        );
        duel.state = 2 + winner;
        Ok(())
    }

    pub fn delegate_duel(ctx: Context<DelegateDuel>) -> Result<()> {
        let key = ctx.accounts.duel.key();
        let data = ctx.accounts.duel.try_borrow_data()?;
        let mut duel = Duel::try_deserialize(&mut &data[..])?;
        drop(data);
        require_keys_eq!(
            *ctx.accounts.duel.owner,
            crate::ID,
            WildError::MatchUnavailable
        );
        require_keys_eq!(duel.host, ctx.accounts.payer.key(), WildError::WrongTurn);
        require!(
            duel.state == 1 && duel.moves == 0 && !duel.rolled_up,
            WildError::MatchUnavailable
        );
        let nonce = duel.nonce.to_le_bytes();
        let seeds = &[DUEL, duel.host.as_ref(), nonce.as_ref()];
        require_keys_eq!(Pubkey::find_program_address(seeds, &crate::ID).0, key);
        duel.rolled_up = true;
        duel.try_serialize(&mut &mut ctx.accounts.duel.try_borrow_mut_data()?[..])?;
        ctx.accounts.delegate_duel(
            &ctx.accounts.payer,
            seeds,
            DelegateConfig {
                validator: Some(ROLLUP_VALIDATOR),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn initialize_currency(_ctx: Context<InitializeCurrency>) -> Result<()> {
        Ok(())
    }

    pub fn claim_wild(ctx: Context<ClaimWild>) -> Result<()> {
        let duel = &mut ctx.accounts.duel;
        require!(
            (2..=3).contains(&duel.state) && duel.rolled_up && !duel.rewarded,
            WildError::MatchUnavailable
        );
        let winner = (duel.state - 2) as usize;
        require!(duel.hp[1 - winner] == 0, WildError::MatchUnavailable);
        require_keys_eq!(
            ctx.accounts.winner.key(),
            duel.players()[winner],
            WildError::WrongTurn
        );
        let bump = [ctx.bumps.mint];
        let seeds: &[&[u8]] = &[CURRENCY, &bump];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.mint.to_account_info(),
                },
                &[seeds],
            ),
            12_000_000,
        )?;
        duel.rewarded = true;
        Ok(())
    }

    pub fn buy_wild(ctx: Context<BuyWild>) -> Result<()> {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            100_000_000,
        )?;
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.mint.to_account_info(),
                },
                &[&[CURRENCY, &[ctx.bumps.mint]]],
            ),
            24_000_000,
        )
    }

    pub fn open_box(ctx: Context<OpenBox>, nonce: u64, kind: u8) -> Result<()> {
        let cost = match kind {
            0 => 6_000_000,
            1 => 12_000_000,
            _ => return err!(WildError::InvalidBox),
        };
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                token::Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.source.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            cost,
        )?;
        let receipt = &mut ctx.accounts.receipt;
        receipt.set_inner(BoxOpening {
            buyer: ctx.accounts.buyer.key(),
            nonce,
            kind,
            roll: 255,
        });
        let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.buyer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::RevealBox::DISCRIMINATOR.to_vec(),
            caller_seed: receipt.key().to_bytes(),
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: receipt.key(),
                is_signer: false,
                is_writable: true,
            }]),
            ..Default::default()
        });
        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.buyer.to_account_info(), &ix)?;
        Ok(())
    }

    pub fn reveal_box(ctx: Context<RevealBox>, randomness: [u8; 32]) -> Result<()> {
        require!(ctx.accounts.receipt.roll == 255, WildError::InvalidBox);
        ctx.accounts.receipt.roll = random_u8_with_range(&randomness, 0, 99);
        Ok(())
    }

    pub fn mint_beast(ctx: Context<MintBeast>, beast_id: [u8; 16]) -> Result<()> {
        let bump = [ctx.bumps.mint];
        let seeds: &[&[u8]] = &[BEAST, &beast_id, &bump];
        let mint_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.mint.to_account_info(),
        };
        token::mint_to(
            CpiContext::new_with_signer(ctx.accounts.token_program.key(), mint_accounts, &[seeds]),
            1,
        )?;
        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                SetAuthority {
                    current_authority: ctx.accounts.mint.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
                &[seeds],
            ),
            token::spl_token::instruction::AuthorityType::MintTokens,
            None,
        )
    }

    pub fn settle_duel(ctx: Context<SettleDuel>) -> Result<()> {
        require!(ctx.accounts.duel.state >= 2, WildError::MatchUnavailable);
        require!(
            ctx.accounts
                .duel
                .players()
                .contains(&ctx.accounts.payer.key()),
            WildError::WrongTurn
        );
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.duel.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn offer_asset(
        ctx: Context<OfferAsset>,
        nonce: u64,
        amount: u64,
        lamports: u64,
    ) -> Result<()> {
        require!(amount > 0 && lamports > 0, WildError::InvalidOffer);
        require!(
            ctx.accounts.mint.freeze_authority.is_none(),
            WildError::FrozenMint
        );
        ctx.accounts.offer.set_inner(Offer {
            seller: ctx.accounts.seller.key(),
            mint: ctx.accounts.mint.key(),
            nonce,
            amount,
            lamports,
        });
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.source.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )
    }

    pub fn buy_asset(
        ctx: Context<BuyAsset>,
        max_lamports: u64,
        expected_amount: u64,
    ) -> Result<()> {
        let offer = &ctx.accounts.offer;
        require!(
            offer.lamports <= max_lamports
                && offer.amount == expected_amount
                && ctx.accounts.vault.amount >= offer.amount
                && ctx.accounts.buyer.key() != offer.seller,
            WildError::InvalidOffer
        );
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.seller.to_account_info(),
                },
            ),
            offer.lamports,
        )?;
        release(
            offer,
            ctx.bumps.offer,
            &ctx.accounts.vault,
            &ctx.accounts.mint,
            &ctx.accounts.destination,
            ctx.accounts.seller.to_account_info(),
            &ctx.accounts.token_program,
        )
    }

    pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
        release(
            &ctx.accounts.offer,
            ctx.bumps.offer,
            &ctx.accounts.vault,
            &ctx.accounts.mint,
            &ctx.accounts.destination,
            ctx.accounts.seller.to_account_info(),
            &ctx.accounts.token_program,
        )
    }
}

fn release<'info>(
    offer: &Account<'info, Offer>,
    bump: u8,
    vault: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    destination: &Account<'info, TokenAccount>,
    seller: AccountInfo<'info>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    let nonce = offer.nonce.to_le_bytes();
    let bump = [bump];
    let seeds: &[&[u8]] = &[OFFER, offer.seller.as_ref(), &nonce, &bump];
    // A third party may send extra tokens to a vault. Drain the full balance
    // so an unsolicited deposit cannot prevent a buy or cancellation.
    token::transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: vault.to_account_info(),
                mint: mint.to_account_info(),
                to: destination.to_account_info(),
                authority: offer.to_account_info(),
            },
            &[seeds],
        ),
        vault.amount,
        mint.decimals,
    )?;
    token::close_account(CpiContext::new_with_signer(
        token_program.key(),
        CloseAccount {
            account: vault.to_account_info(),
            destination: seller,
            authority: offer.to_account_info(),
        },
        &[seeds],
    ))
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct CreateDuel<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(init, payer = host, space = 8 + Duel::INIT_SPACE,
        seeds = [DUEL, host.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub duel: Account<'info, Duel>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinDuel<'info> {
    pub opponent: Signer<'info>,
    #[account(mut, has_one = opponent)]
    pub duel: Account<'info, Duel>,
}

#[derive(Accounts)]
pub struct PlayDuel<'info> {
    pub player: Signer<'info>,
    #[account(mut)]
    pub duel: Account<'info, Duel>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateDuel<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The instruction checks the owner, seeds, host, and match state.
    #[account(mut, del)]
    pub duel: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct SettleDuel<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub duel: Account<'info, Duel>,
}

#[account]
#[derive(InitSpace)]
pub struct Duel {
    pub host: Pubkey,
    pub opponent: Pubkey,
    pub nonce: u64,
    pub hp: [u8; 2],
    pub guarding: [bool; 2],
    pub burn: [u8; 2],
    pub turn: u8,
    pub moves: u16,
    pub last_move: u8,
    pub last_damage: u8,
    pub deadline: i64,
    pub state: u8,
    pub rewarded: bool,
    pub rolled_up: bool,
}

#[derive(Accounts)]
pub struct InitializeCurrency<'info> {
    #[account(mut, address = DEPLOYER)]
    pub payer: Signer<'info>,
    #[account(init, payer = payer, seeds = [CURRENCY], bump, mint::decimals = 6, mint::authority = mint)]
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuyWild<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, address = DEPLOYER)]
    pub treasury: SystemAccount<'info>,
    #[account(mut, seeds = [CURRENCY], bump)]
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = buyer)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct BoxOpening {
    pub buyer: Pubkey,
    pub nonce: u64,
    pub kind: u8,
    pub roll: u8,
}

#[vrf]
#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct OpenBox<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(init, payer = buyer, space = 50, seeds = [b"box", buyer.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub receipt: Account<'info, BoxOpening>,
    #[account(mut, seeds = [CURRENCY], bump)]
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = buyer)]
    pub source: Account<'info, TokenAccount>,
    /// CHECK: Fixed MagicBlock Solana VRF queue.
    #[account(mut, address = BOX_QUEUE)]
    pub oracle_queue: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct RevealBox<'info> {
    #[account(mut)]
    pub receipt: Account<'info, BoxOpening>,
}

#[derive(Accounts)]
pub struct ClaimWild<'info> {
    pub winner: Signer<'info>,
    #[account(mut)]
    pub duel: Account<'info, Duel>,
    #[account(mut, seeds = [CURRENCY], bump)]
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = winner)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(beast_id: [u8; 16])]
pub struct MintBeast<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(address = DEPLOYER)]
    pub issuer: Signer<'info>,
    #[account(init, payer = owner, seeds = [BEAST, &beast_id], bump, mint::decimals = 0, mint::authority = mint)]
    pub mint: Account<'info, Mint>,
    #[account(init, payer = owner, associated_token::mint = mint, associated_token::authority = owner)]
    pub destination: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
impl Duel {
    fn players(&self) -> [Pubkey; 2] {
        [self.host, self.opponent]
    }
    fn resolve_move(&mut self, action: u8, now: i64) -> Result<()> {
        let actor = self.turn as usize;
        let target = 1 - actor;
        let mut damage: u8 = match action {
            0 => 8,
            1 => 10,
            2 => {
                self.guarding[actor] = true;
                0
            }
            3 => {
                self.burn[target] = 2;
                5
            }
            _ => return err!(WildError::InvalidMove),
        };
        if damage > 0 && self.guarding[target] {
            damage = damage.div_ceil(2);
            self.guarding[target] = false;
        }
        if self.burn[target] > 0 {
            damage += 2;
            self.burn[target] -= 1;
        }
        self.hp[target] = self.hp[target].saturating_sub(damage);
        self.moves = self
            .moves
            .checked_add(1)
            .ok_or(WildError::MatchUnavailable)?;
        self.last_move = action;
        self.last_damage = damage;
        self.turn = target as u8;
        self.deadline = now + TURN_SECS;
        if self.hp[target] == 0 {
            self.state = 2 + actor as u8;
        }
        if self.moves == 256 && self.state == 1 {
            self.state = 4;
        }
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct OfferAsset<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = seller)]
    pub source: Account<'info, TokenAccount>,
    #[account(init, payer = seller, space = 8 + Offer::INIT_SPACE,
        seeds = [OFFER, seller.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub offer: Account<'info, Offer>,
    #[account(init, payer = seller, token::mint = mint, token::authority = offer,
        seeds = [VAULT, offer.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuyAsset<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub seller: SystemAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = buyer)]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut, close = seller, has_one = seller, has_one = mint,
        seeds = [OFFER, seller.key().as_ref(), &offer.nonce.to_le_bytes()], bump)]
    pub offer: Account<'info, Offer>,
    #[account(mut, token::mint = mint, token::authority = offer,
        seeds = [VAULT, offer.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelOffer<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = seller)]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut, close = seller, has_one = seller, has_one = mint,
        seeds = [OFFER, seller.key().as_ref(), &offer.nonce.to_le_bytes()], bump)]
    pub offer: Account<'info, Offer>,
    #[account(mut, token::mint = mint, token::authority = offer,
        seeds = [VAULT, offer.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub nonce: u64,
    pub amount: u64,
    pub lamports: u64,
}

#[error_code]
pub enum WildError {
    #[msg("Choose a different wallet to challenge.")]
    InvalidOpponent,
    #[msg("Match is not available for this action.")]
    MatchUnavailable,
    #[msg("This wallet cannot take that turn.")]
    WrongTurn,
    #[msg("Unknown move.")]
    InvalidMove,
    #[msg("Invalid price or asset amount.")]
    InvalidOffer,
    #[msg("Escrow requires a mint without a freeze authority.")]
    FrozenMint,
    #[msg("Invalid or completed box opening.")]
    InvalidBox,
}
