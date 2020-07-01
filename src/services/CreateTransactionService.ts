import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import TransactionRepository from '../repositories/TransactionsRepository';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transctionRepository = getCustomRepository(TransactionRepository);
    const categoryRepository = getRepository(Category);

    // verifica se pode criar um registro de acordo com o saldo
    const { total } = await transctionRepository.getBalance();

    if (type === 'outcome' && total < value) {
      throw new AppError('You do not have enough balance');
    }

    // verificar categoria se existe
    let transactionCategory = await categoryRepository.findOne({
      where: {
        title: category,
      },
    });

    // não existe? criar caterogia, senão utilza a que encontrou
    if (!transactionCategory) {
      transactionCategory = categoryRepository.create({
        title: category,
      });

      await categoryRepository.save(transactionCategory);
    }

    const transaction = transctionRepository.create({
      title,
      value,
      type,
      category: transactionCategory,
    });

    await transctionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
