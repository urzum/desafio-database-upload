import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParce from 'csv-parse';
import fs from 'fs';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const contactsReadStreem = fs.createReadStream(filePath);

    const pasers = csvParce({
      from_line: 2, // inicia da linha 2 para não pegar o cabeçalho
    });

    const parseCSV = contactsReadStreem.pipe(pasers); // vai ler as linhas conforme forem disponiveis

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve)); // incluido para esperar terminar a rotina por não ser assincrona

    // verifica se existe a categoria
    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    // deixa apenas as categorias que existem no banco
    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    // verifica as categorias que exietm e inclui nesse objeto apenas as que não existem
    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index); // aqui ele filtra para que não tenha categoria duplicada, onde o 'self' é o array de category que está no primeiro filter

    // faz um map da criação das categorias para que sejam criadas de uma unica vez
    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    // cria varivel com todas as categorias
    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionRepository.save(createdTransactions);

    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
