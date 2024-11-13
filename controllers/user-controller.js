import { readUsersFromFile, writeUsersToFile } from './user-json-controller.js'
import bcrypt from 'bcrypt'
import multer from 'multer'
import path from 'path'
import { loadProfileImg } from '../utils/load-profile-img.js'

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '../uploads/')
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fieldSize: 25 * 1024 * 1024,
    fileSize: 10 * 1024 * 1024,
  },
})

export const registerUser = (req, res) => {
  upload.single('profile_pic')(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json({ message: '프로필 이미지 등록에 실패했습니다.' })
    }

    const { email, password, nickname } = req.body
    const users = readUsersFromFile()

    const existingUserEmail = users.find((user) => user.user_email === email)
    const existingUserName = users.find((user) => user.user_name === nickname)

    if (existingUserEmail || existingUserName) {
      if (existingUserEmail) {
        return res.status(400).json({ message: '이미 존재하는 이메일입니다.' })
      } else if (existingUserName) {
        return res.status(400).json({ message: '중복된 닉네임 입니다.' })
      }
    }

    const hashedPw = bcrypt.hashSync(password, 10)

    const newUser = {
      user_email: email,
      user_pw: hashedPw,
      user_name: nickname,
      profile_picture: req.file ? req.file.filename : null,
    }

    users.push(newUser)
    writeUsersToFile(users)

    res.status(201).json({ message: '회원가입이 완료되었습니다.' })
  })
}

export const loginUser = (req, res) => {
  const { email, password } = req.body
  const users = readUsersFromFile()

  const user = users.find((user) => user.user_email === email)
  if (user) {
    const checkPw = bcrypt.compareSync(password, user.user_pw)
    if (checkPw) {
      console.log(user.profile_picture)
      const sessionUser = {
        email: user.user_email,
        nickname: user.user_name,
        profile_picture: null,
      }

      if (user.profile_picture) {
        const imagePath = path.isAbsolute(user.profile_picture)
          ? user.profile_picture
          : path.join('../uploads', user.profile_picture)
        sessionUser.profile_picture = loadProfileImg(imagePath)
      }

      req.session.user = sessionUser
      res.status(200).json({
        message: '로그인에 성공하였습니다.',
        user: req.session.user,
      })
      console.log('login session:', req.session)
    } else {
      res.status(400).json({ message: '비밀번호가 틀렸습니다.' })
    }
  } else {
    res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
  }
}

export const userInfo = (req, res) => {
  upload.single('new_profile_img')(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json({ message: '프로필 이미지 변경에 실패했습니다.' })
    }

    const { email, nickname } = req.body

    const users = readUsersFromFile()

    const existingUser = users.find((user) => user.user_name === nickname)
    if (existingUser) {
      return res.status(400).json({ message: '중복된 닉네임 입니다.' })
    }

    const user = users.find((user) => user.user_email === email)

    if (user) {
      user.user_name = nickname
      if (req.file) {
        user.profile_picture = req.file.filename
      }
      writeUsersToFile(users)
      res.status(200).json({ message: '사용자 정보가 업데이트 되었습니다.' })
    } else {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
    }
  })
}

export const userPw = (req, res) => {
  const { email, password } = req.body
  const users = readUsersFromFile()

  const user = users.find((user) => user.user_email === email)
  if (user) {
    user.user_pw = bcrypt.hashSync(password, 10)
    writeUsersToFile(users)
    res.status(200).json({ message: '비밀번호가 업데이트 되었습니다.' })
  } else {
    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
  }
}

export const deleteUser = (req, res) => {
  const email = req.params.email
  const users = readUsersFromFile()

  const userIndex = users.findIndex((user) => user.user_email === email)
  if (userIndex === -1) {
    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
  }

  users.splice(userIndex, 1)
  writeUsersToFile(users)
  res.status(204).send()
}

export const logoutUser = (req, res) => {
  try {
    req.session = null
    res.clearCookie('session')

    res.status(200).json({ message: '로그아웃에 성공하였습니다.' })
  } catch (error) {
    res.status(500).json({ message: '로그아웃에 실패하였습니다.' })
  }
}
